"use server";

/**
 * Le parcours d'une demande, côté équipe (migrations 020-021) :
 *
 *   Nouvelle → Prise en charge → Qualification → { Refus | Orientation | Vote }
 *   Vote → décision de l'admin → Admise (le projet s'ouvre) ou Non retenue
 *
 * La qualification est le moment clé : un partenaire dit si le projet colle à
 * l'ADN d'ArcInnoLab, puis choisit la suite. Le vote n'est proposé que pour un
 * projet qui y colle — soumettre au consortium un projet hors ADN ferait
 * perdre son temps à tout le monde, porteur compris.
 */

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { DemandeStatut } from "@/lib/types";

type Resultat = { error?: string; success?: boolean };
type Client = Awaited<ReturnType<typeof createServerClient>>;

function rafraichir(demandeId: string) {
  revalidatePath("/demandes");
  revalidatePath(`/demandes/${demandeId}`);
  revalidatePath("/promotions");
  revalidatePath("/");
}

async function equipier(supabase: Client) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profil } = await supabase.from("profiles").select("id, prenom, nom, role").eq("id", user.id).maybeSingle();
  if (!profil || (profil.role !== "admin" && profil.role !== "partenaire")) return null;
  return profil as { id: string; prenom: string; nom: string; role: "admin" | "partenaire" };
}

async function notifier(
  supabase: Client,
  destinataires: string[],
  auteurId: string,
  type: string,
  titre: string,
  lien: string
) {
  const ids = [...new Set(destinataires)].filter((id) => id && id !== auteurId);
  if (!ids.length) return;
  await supabase.from("notifications").insert(ids.map((user_id) => ({ user_id, type, titre, lien })));
}

/**
 * Met à jour une demande seulement si elle est dans l'un des statuts attendus.
 * Sans cette garde, un clic sur une fiche restée ouverte pourrait, par exemple,
 * refuser une demande déjà mise au vote par quelqu'un d'autre.
 */
async function majSi(supabase: Client, demandeId: string, statuts: DemandeStatut[], maj: Record<string, unknown>): Promise<Resultat> {
  const { data, error } = await supabase
    .from("demandes_accueil")
    .update(maj)
    .eq("id", demandeId)
    .in("statut", statuts)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Cette demande a changé d'étape entre-temps : rechargez la page." };
  return { success: true };
}

const EN_QUALIFICATION: DemandeStatut[] = ["en_accueil", "en_qualification", "en_attente_comite"];

// ── Glisser-déposer dans le tableau des demandes ─────────────────────────────

/**
 * Les seuls déplacements permis au glisser-déposer : faire avancer ou reculer
 * une demande entre Nouvelle, Prise en charge et Qualification. Les décisions
 * (refus, orientation, vote, admission) passent par la fiche, avec un motif.
 */
export async function deplacerDemande(demandeId: string, cible: DemandeStatut): Promise<Resultat> {
  if (!["en_accueil", "en_qualification"].includes(cible)) {
    return { error: "Cette étape se décide depuis la fiche, avec un motif." };
  }
  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };

  const { data: d } = await supabase.from("demandes_accueil").select("statut, coach_id, titre_projet").eq("id", demandeId).maybeSingle();
  if (!d) return { error: "Demande introuvable." };
  if (!["nouvelle", "en_accueil", "en_qualification", "en_attente_comite"].includes(d.statut)) {
    return { error: "Cette demande a déjà sa suite : rouvrez-la depuis sa fiche." };
  }

  // Faire avancer une demande que personne ne suit, c'est la prendre en charge.
  const maj: Record<string, unknown> = { statut: cible };
  if (!d.coach_id) maj.coach_id = moi.id;

  const { error } = await supabase.from("demandes_accueil").update(maj).eq("id", demandeId);
  if (error) return { error: error.message };
  rafraichir(demandeId);
  return { success: true };
}

/**
 * Reprendre le suivi d'une demande dont l'interlocuteur n'existe plus (compte
 * supprimé) : on change de suivi sans toucher à l'étape où elle en est.
 */
export async function reprendreSuivi(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };
  const { error } = await supabase.from("demandes_accueil").update({ coach_id: moi.id }).eq("id", demandeId);
  if (error) return { error: error.message };
  rafraichir(demandeId);
  return { success: true };
}

/** Bouton « Passer en qualification » de la fiche. */
export async function passerEnQualification(_prev: Resultat, formData: FormData): Promise<Resultat> {
  return deplacerDemande(String(formData.get("demande_id") || ""), "en_qualification");
}

/** Rouvre une demande orientée, refusée ou close : elle revient en qualification. */
export async function rouvrirQualification(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };
  const { data: d } = await supabase.from("demandes_accueil").select("statut").eq("id", demandeId).maybeSingle();
  if (!d) return { error: "Demande introuvable." };
  if (d.statut === "non_retenue" && moi.role !== "admin") {
    const { count } = await supabase.from("tours_vote").select("id", { count: "exact", head: true }).eq("demande_id", demandeId);
    if (count) return { error: "Ce refus a été prononcé après un vote : seul un administrateur peut rouvrir la demande." };
  }
  const r = await majSi(supabase, demandeId, ["orientee", "non_retenue", "close"], { statut: "en_qualification", message_porteur: null });
  if (r.error) return r;
  rafraichir(demandeId);
  return { success: true };
}

// ── Qualification ────────────────────────────────────────────────────────────

/** Profil, notes d'appel et avis sur l'ADN. Enregistrable autant de fois que voulu. */
export async function enregistrerQualification(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const persona = String(formData.get("persona") || "").trim();
  const precision = String(formData.get("persona_precision") || "").trim();
  const notes = String(formData.get("notes_coach") || "").trim();
  const adn = String(formData.get("adn") || "");
  if (!demandeId) return { error: "Demande introuvable." };
  if (persona === "autre" && precision.length < 3) {
    return { error: "Précisez le profil en quelques mots." };
  }

  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };

  const maj: Record<string, unknown> = {
    persona: persona || null,
    persona_precision: persona === "autre" ? precision.slice(0, 200) : null,
    notes_coach: notes || null,
  };
  if (adn === "oui" || adn === "non") {
    maj.adn_arcinnolab = adn === "oui";
    maj.qualifie_par = moi.id;
    maj.qualifie_le = new Date().toISOString();
  }

  const { error } = await supabase.from("demandes_accueil").update(maj).eq("id", demandeId);
  if (error) return { error: "Enregistrement impossible : " + error.message };
  rafraichir(demandeId);
  return { success: true };
}

/** Refus, avec un message au porteur : c'est ce qu'il lira sur sa page de suivi. */
export async function refuserDemande(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const message = String(formData.get("message_porteur") || "").trim();
  if (message.length < 30) {
    return { error: "Expliquez au porteur pourquoi, en quelques phrases : il lira ce message sur sa page de suivi." };
  }
  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };

  const r = await majSi(supabase, demandeId, EN_QUALIFICATION, { statut: "non_retenue", message_porteur: message });
  if (r.error) return r;
  rafraichir(demandeId);
  return { success: true };
}

/**
 * Orientation vers un partenaire d'ArcInnoLab (le partenaire est prévenu) ou
 * vers une autre structure. Le suivi de l'issue continue ensuite sur la fiche.
 */
export async function orienterVersPartenaire(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const partenaireId = String(formData.get("partenaire_id") || "");
  const autre = String(formData.get("structure_autre") || "").trim();
  const motif = String(formData.get("motif") || "").trim();
  const relance = String(formData.get("date_relance") || "").trim();
  const message = String(formData.get("message_porteur") || "").trim();

  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };

  let structure = autre;
  if (partenaireId && partenaireId !== "autre") {
    const { data: p } = await supabase.from("profiles").select("prenom, nom, organisation").eq("id", partenaireId).maybeSingle();
    if (!p) return { error: "Partenaire introuvable." };
    structure = `${p.organisation ? `${p.organisation} — ` : ""}${p.prenom} ${p.nom}`;
  }
  if (!structure) return { error: "Choisissez le partenaire, ou nommez la structure." };
  if (motif.length < 5) return { error: "Dites en une phrase ce que ce partenaire apporte au projet." };

  const bascule = await majSi(supabase, demandeId, EN_QUALIFICATION, { statut: "orientee", message_porteur: message || null });
  if (bascule.error) return bascule;

  const { error } = await supabase.from("orientations").insert({
    demande_id: demandeId,
    structure,
    motif,
    date_relance: relance || null,
    cree_par: moi.id,
  });
  if (error) {
    // L'orientation n'a pas pu être enregistrée : la demande reste à qualifier.
    await supabase.from("demandes_accueil").update({ statut: "en_qualification", message_porteur: null }).eq("id", demandeId);
    return { error: "Orientation non enregistrée : " + error.message };
  }

  const { data: d } = await supabase.from("demandes_accueil").select("titre_projet").eq("id", demandeId).single();

  if (partenaireId && partenaireId !== "autre") {
    await notifier(
      supabase,
      [partenaireId],
      moi.id,
      "demande_accueil",
      `${moi.prenom} vous oriente un porteur : « ${d?.titre_projet ?? "une demande"} »`,
      `/demandes/${demandeId}`
    );
  }
  rafraichir(demandeId);
  return { success: true };
}

/**
 * Mise au vote des partenaires en vue d'une promotion. Exige un avis « colle à
 * l'ADN » enregistré : c'est la condition pour mobiliser tout le consortium.
 */
export async function mettreAuVote(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const promotionId = String(formData.get("promotion_id") || "");
  if (!promotionId) return { error: "Choisissez la promotion visée." };

  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };

  const { data: d } = await supabase.from("demandes_accueil").select("adn_arcinnolab").eq("id", demandeId).maybeSingle();
  if (!d) return { error: "Demande introuvable." };
  if (d.adn_arcinnolab !== true) {
    return { error: "Enregistrez d'abord que le projet colle à l'ADN d'ArcInnoLab." };
  }
  const { data: promo } = await supabase.from("promotions").select("ouverte").eq("id", promotionId).maybeSingle();
  if (!promo?.ouverte) return { error: "Cette promotion n'est pas ouverte aux candidatures." };

  const { data: dejaOuvert } = await supabase
    .from("tours_vote")
    .select("id")
    .eq("demande_id", demandeId)
    .in("statut", ["en_cours", "complet"])
    .maybeSingle();
  if (dejaOuvert) return { error: "Un vote est déjà ouvert sur cette demande." };

  // Le statut d'abord, avec sa garde : si quelqu'un a déjà décidé de la suite,
  // on n'ouvre pas de vote pour rien.
  const bascule = await majSi(supabase, demandeId, EN_QUALIFICATION, { statut: "en_instruction", promotion_id: promotionId });
  if (bascule.error) return bascule;

  // Nombre de votants figé à l'ouverture : un partenaire arrivé en cours de
  // route ne doit pas rendre incomplet un vote qui ne l'était pas.
  const { data: attendus } = await supabase.rpc("nb_votants_attendus");
  const { error } = await supabase.from("tours_vote").insert({
    demande_id: demandeId,
    promotion_id: promotionId,
    ouvert_par: moi.id,
    votants_attendus: attendus ?? 1,
  });
  if (error) {
    await supabase.from("demandes_accueil").update({ statut: "en_qualification" }).eq("id", demandeId);
    return { error: "Ouverture du vote impossible : " + error.message };
  }

  rafraichir(demandeId);
  return { success: true };
}

/**
 * Abandon d'un vote (personne n'a voté, ou il faut requalifier) : la demande
 * revient en qualification. Réservé à l'administrateur.
 */
export async function abandonnerVote(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (moi?.role !== "admin") return { error: "Seul un administrateur peut abandonner un vote." };

  const { error } = await supabase
    .from("tours_vote")
    .update({ statut: "abandonne", clos_le: new Date().toISOString(), clos_par: moi.id })
    .eq("demande_id", demandeId)
    .in("statut", ["en_cours", "complet", "clos"]);
  if (error) return { error: error.message };
  const r = await majSi(supabase, demandeId, ["en_instruction"], { statut: "en_qualification" });
  if (r.error) return r;
  rafraichir(demandeId);
  return { success: true };
}

/** Classement sans suite (doublon, message vide, démarchage). */
export async function classerSansSuite(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };
  const r = await majSi(supabase, demandeId, ["nouvelle", ...EN_QUALIFICATION], { statut: "close" });
  if (r.error) return r;
  rafraichir(demandeId);
  return { success: true };
}

// ── Fil interne de l'équipe ──────────────────────────────────────────────────

/** Message interne, avec mentions : les personnes mentionnées sont prévenues. */
export async function envoyerNoteInterne(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const demandeId = String(formData.get("demande_id") || "");
  const contenu = String(formData.get("contenu") || "").trim();
  const demandees = formData.getAll("mentions").map(String).filter(Boolean);
  if (!contenu) return { error: "Écrivez votre message." };

  const supabase = await createServerClient();
  const moi = await equipier(supabase);
  if (!moi) return { error: "Réservé à l'équipe." };

  // On ne mentionne que des membres de l'équipe : un porteur ne doit jamais
  // être prévenu d'un message qu'il ne peut pas lire.
  const { data: equipe } = demandees.length
    ? await supabase.from("profiles").select("id").in("id", demandees).in("role", ["admin", "partenaire"])
    : { data: [] as { id: string }[] };
  const mentions = (equipe ?? []).map((p) => p.id as string);

  const { error } = await supabase
    .from("notes_demande")
    .insert({ demande_id: demandeId, auteur_id: moi.id, contenu, mentions });
  if (error) return { error: "Message non envoyé : " + error.message };

  const { data: d } = await supabase.from("demandes_accueil").select("titre_projet, coach_id").eq("id", demandeId).maybeSingle();
  const titre = d?.titre_projet ?? "une demande";
  await notifier(supabase, mentions, moi.id, "mention", `${moi.prenom} vous mentionne sur « ${titre} »`, `/demandes/${demandeId}#discussion`);
  // L'interlocuteur du porteur suit tout ce qui se dit sur son dossier.
  if (d?.coach_id && !mentions.includes(d.coach_id)) {
    await notifier(supabase, [d.coach_id], moi.id, "mention", `${moi.prenom} a écrit sur « ${titre} »`, `/demandes/${demandeId}#discussion`);
  }

  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}
