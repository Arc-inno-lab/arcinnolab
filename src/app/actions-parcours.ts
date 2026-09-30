"use server";

/**
 * Actions du parcours configurable (migration 018) : colonnes libres, étapes,
 * rendez-vous et documents, validation par le référent.
 *
 * Les droits ne se jouent pas ici mais en base : la RLS dit qui peut écrire, et
 * deux triggers disent le reste — déposer une étape dans la colonne terminale
 * la soumet au référent, et seul le référent peut la valider ou la refuser.
 * Ces actions se contentent donc de traduire un geste en écriture, puis de
 * prévenir les bonnes personnes.
 */

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notifierProjet } from "@/lib/notifier";
import { versInstantParis } from "@/lib/parcours";
import type { ElementParcours, RdvMode } from "@/lib/types";

type Resultat = { error?: string; success?: boolean };

function rafraichir(projetId: string) {
  revalidatePath(`/projets/${projetId}`);
  revalidatePath("/mon-projet");
  revalidatePath("/mon-projet/messages");
  revalidatePath("/");
}

async function colonnesDuProjet(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  projetId: string
) {
  const { data } = await supabase
    .from("colonnes_projet")
    .select("id, nom, ordre, terminale")
    .eq("projet_id", projetId)
    .order("ordre", { ascending: true });
  const colonnes = data ?? [];
  return {
    colonnes,
    premiere: colonnes.find((c) => !c.terminale) ?? colonnes[0] ?? null,
    terminale: colonnes.find((c) => c.terminale) ?? null,
    // La dernière colonne « de travail », juste avant la terminale : c'est là
    // que revient une étape refusée.
    enCours: [...colonnes].reverse().find((c) => !c.terminale) ?? null,
  };
}

async function nomDe(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
) {
  const { data } = await supabase.from("profiles").select("prenom, nom").eq("id", userId).maybeSingle();
  return data ? `${data.prenom} ${data.nom}` : "Quelqu'un";
}

// ── Éléments du parcours ─────────────────────────────────────────────────────

/**
 * Ajoute une étape, un rendez-vous ou un document à fournir. Un seul
 * formulaire pour les trois, parce que c'est une seule question pour le
 * porteur : « qu'est-ce qui vient ensuite ? ».
 */
export async function ajouterAuParcours(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const projetId = String(formData.get("projet_id") || "");
  const type = String(formData.get("type") || "etape") as ElementParcours;
  const titre = String(formData.get("titre") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const echeance = String(formData.get("date_echeance") || "").trim();
  const colonneDemandee = String(formData.get("colonne_id") || "").trim();

  if (!projetId) return { error: "Projet introuvable." };
  if (!["etape", "rendez_vous", "document"].includes(type)) return { error: "Type inconnu." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée : reconnectez-vous." };

  const { premiere } = await colonnesDuProjet(supabase, projetId);
  const { count } = await supabase
    .from("etapes_projet")
    .select("id", { count: "exact", head: true })
    .eq("projet_id", projetId);

  const ligne: Record<string, unknown> = {
    projet_id: projetId,
    type,
    ordre: count ?? 0,
    colonne_id: colonneDemandee || premiere?.id || null,
    description: description || null,
    cree_par: user.id,
  };

  if (type === "rendez_vous") {
    const jour = String(formData.get("rdv_jour") || "").trim();
    const heure = String(formData.get("rdv_heure") || "").trim();
    const mode = String(formData.get("rdv_mode") || "visio") as RdvMode;
    const lieu = String(formData.get("rdv_lieu") || "").trim();
    const avec = String(formData.get("rdv_avec") || "").trim();
    if (!jour || !heure) return { error: "Indiquez le jour et l'heure du rendez-vous." };
    const debut = versInstantParis(jour, heure);
    if (!debut) return { error: "Date ou heure illisible." };
    // L'objet du rendez-vous en devient le titre s'il est court : « Point sur
    // les acheteurs suisses » parle plus que « Rendez-vous ».
    if (!titre && description && description.length <= 80 && !description.includes("\n")) {
      ligne.titre = description;
      ligne.description = null;
    } else {
      ligne.titre = titre || "Rendez-vous";
    }
    ligne.rdv_debut = debut;
    ligne.rdv_mode = ["visio", "telephone", "sur_place"].includes(mode) ? mode : "visio";
    ligne.rdv_lieu = lieu || null;
    ligne.rdv_avec = avec || null;
    ligne.rdv_statut = "propose";
  } else {
    if (titre.length < 2) return { error: "Donnez un titre en quelques mots." };
    ligne.titre = titre;
    ligne.date_echeance = echeance || null;
  }

  const { error } = await supabase.from("etapes_projet").insert(ligne);
  if (error) return { error: "Ajout impossible : " + error.message };

  const qui = await nomDe(supabase, user.id);
  const quoi =
    type === "rendez_vous"
      ? `${qui} propose un rendez-vous`
      : type === "document"
        ? `${qui} a ajouté un document à fournir : « ${titre} »`
        : `${qui} a ajouté une étape : « ${titre} »`;
  await notifierProjet(supabase, projetId, user.id, type === "rendez_vous" ? "rendez_vous" : "etape_ajoutee", quoi);

  rafraichir(projetId);
  return { success: true };
}

/** Ajout express depuis le tableau de l'équipe : un titre, une colonne. */
export async function ajouterEtapeRapide(projetId: string, colonneId: string | null, titre: string): Promise<Resultat> {
  const texte = titre.trim();
  if (!texte) return { error: "Donnez un titre à l'étape." };
  const fd = new FormData();
  fd.set("projet_id", projetId);
  fd.set("type", "etape");
  fd.set("titre", texte);
  if (colonneId) fd.set("colonne_id", colonneId);
  return ajouterAuParcours({}, fd);
}

/** Déplace une étape de colonne. La base en déduit la demande de validation. */
export async function deplacerEtape(projetId: string, etapeId: string, colonneId: string): Promise<Resultat> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("etapes_projet").update({ colonne_id: colonneId }).eq("id", etapeId);
  if (error) return { error: error.message };
  rafraichir(projetId);
  return { success: true };
}

/**
 * « C'est fait » : l'étape rejoint la colonne terminale, ce qui la soumet au
 * référent. Le porteur n'a pas à savoir comment s'appellent les colonnes.
 */
export async function marquerFaite(projetId: string, etapeId: string): Promise<Resultat> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { terminale } = await colonnesDuProjet(supabase, projetId);
  if (!terminale) return { error: "Ce projet n'a pas de colonne « terminé »." };

  const { data: etape, error } = await supabase
    .from("etapes_projet")
    .update({ colonne_id: terminale.id })
    .eq("id", etapeId)
    .select("titre")
    .single();
  if (error) return { error: error.message };

  const qui = await nomDe(supabase, user.id);
  await notifierProjet(
    supabase,
    projetId,
    user.id,
    "etape_a_valider",
    `${qui} a terminé « ${etape.titre} » : à valider`,
    { seulementEquipe: true }
  );
  rafraichir(projetId);
  return { success: true };
}

/**
 * Validation ou refus par le référent. Une étape validée rejoint la colonne
 * terminale ; une étape refusée revient dans la dernière colonne de travail,
 * avec l'avis qui explique pourquoi.
 */
export async function trancherEtape(
  projetId: string,
  etapeId: string,
  decision: "validee" | "refusee",
  avis?: string
): Promise<Resultat> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { terminale, enCours } = await colonnesDuProjet(supabase, projetId);
  const cible = decision === "validee" ? terminale : enCours;

  const { data: etape, error } = await supabase
    .from("etapes_projet")
    .update({
      validation: decision,
      avis: avis?.trim() || null,
      id_partenaire_validateur: user.id,
      date_validation: new Date().toISOString(),
      ...(cible ? { colonne_id: cible.id } : {}),
    })
    .eq("id", etapeId)
    .select("titre")
    .single();
  if (error) return { error: error.message };

  await notifierProjet(
    supabase,
    projetId,
    user.id,
    "etape_statut",
    `« ${etape.titre} » ${decision === "validee" ? "a été validée" : "est à reprendre"}`
  );
  rafraichir(projetId);
  return { success: true };
}

/** Confirmation ou annulation d'un rendez-vous proposé. */
export async function repondreRendezVous(
  projetId: string,
  etapeId: string,
  reponse: "confirme" | "annule"
): Promise<Resultat> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { error } = await supabase.from("etapes_projet").update({ rdv_statut: reponse }).eq("id", etapeId);
  if (error) return { error: error.message };

  const qui = await nomDe(supabase, user.id);
  await notifierProjet(
    supabase,
    projetId,
    user.id,
    "rendez_vous",
    reponse === "confirme" ? `${qui} a confirmé le rendez-vous` : `${qui} a annulé le rendez-vous`
  );
  rafraichir(projetId);
  return { success: true };
}

/** « Autre date » : la contre-proposition redevient une proposition. */
export async function deplacerRendezVous(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const projetId = String(formData.get("projet_id") || "");
  const etapeId = String(formData.get("etape_id") || "");
  const jour = String(formData.get("rdv_jour") || "").trim();
  const heure = String(formData.get("rdv_heure") || "").trim();
  const debut = versInstantParis(jour, heure);
  if (!projetId || !etapeId) return { error: "Rendez-vous introuvable." };
  if (!debut) return { error: "Indiquez le jour et l'heure." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { error } = await supabase
    .from("etapes_projet")
    .update({ rdv_debut: debut, rdv_statut: "propose", cree_par: user.id })
    .eq("id", etapeId);
  if (error) return { error: error.message };

  const qui = await nomDe(supabase, user.id);
  await notifierProjet(supabase, projetId, user.id, "rendez_vous", `${qui} propose une autre date de rendez-vous`);
  rafraichir(projetId);
  return { success: true };
}

/** Changement de date butoir, sans ouvrir la fiche complète. */
export async function changerEcheance(projetId: string, etapeId: string, date: string): Promise<Resultat> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("etapes_projet")
    .update({ date_echeance: date || null })
    .eq("id", etapeId);
  if (error) return { error: error.message };
  rafraichir(projetId);
  return { success: true };
}

// ── Colonnes ─────────────────────────────────────────────────────────────────

export async function ajouterColonne(projetId: string, nom: string): Promise<Resultat> {
  const texte = nom.trim();
  if (!texte) return { error: "Donnez un nom à la colonne." };
  const supabase = await createServerClient();
  const { colonnes, terminale } = await colonnesDuProjet(supabase, projetId);

  // Une nouvelle colonne se glisse juste avant « Terminé », qui reste la
  // dernière : c'est là qu'on la cherche.
  const ordreTerminale = terminale?.ordre ?? colonnes.length;
  if (terminale) {
    await supabase.from("colonnes_projet").update({ ordre: ordreTerminale + 1 }).eq("id", terminale.id);
  }
  const { error } = await supabase
    .from("colonnes_projet")
    .insert({ projet_id: projetId, nom: texte, ordre: ordreTerminale });
  if (error) return { error: error.message };
  rafraichir(projetId);
  return { success: true };
}

export async function renommerColonne(projetId: string, colonneId: string, nom: string): Promise<Resultat> {
  const texte = nom.trim();
  if (!texte) return { error: "Le nom ne peut pas être vide." };
  const supabase = await createServerClient();
  const { error } = await supabase.from("colonnes_projet").update({ nom: texte }).eq("id", colonneId);
  if (error) return { error: error.message };
  rafraichir(projetId);
  return { success: true };
}

export async function supprimerColonne(projetId: string, colonneId: string): Promise<Resultat> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("colonnes_projet").delete().eq("id", colonneId);
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  rafraichir(projetId);
  return { success: true };
}

/** Décale une colonne d'un cran ; la colonne terminale reste toujours la dernière. */
export async function decalerColonne(projetId: string, colonneId: string, sens: -1 | 1): Promise<Resultat> {
  const supabase = await createServerClient();
  const { colonnes } = await colonnesDuProjet(supabase, projetId);
  const travail = colonnes.filter((c) => !c.terminale);
  const i = travail.findIndex((c) => c.id === colonneId);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= travail.length) return { success: true };

  const a = travail[i];
  const b = travail[j];
  await supabase.from("colonnes_projet").update({ ordre: b.ordre }).eq("id", a.id);
  await supabase.from("colonnes_projet").update({ ordre: a.ordre }).eq("id", b.id);
  rafraichir(projetId);
  return { success: true };
}
