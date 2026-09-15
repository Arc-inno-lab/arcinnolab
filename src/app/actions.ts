"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/config";
import type { InvitationRoleCible } from "@/lib/types";

type ActionResult = {
  error?: string;
  success?: boolean;
  inviteUrl?: string;
  /** Lien de suivi remis au porteur juste après le dépôt de sa demande. */
  suiviUrl?: string;
};

// ------------------------------------------------------------------
// Bootstrap : création du tout premier compte Admin.
// Passe par la fonction SQL bootstrap_admin() (SECURITY DEFINER, appelée avec la clé anon) —
// elle porte elle-même la garde "un seul admin" et la création du compte Auth, sans clé
// service_role côté application. Bloqué dès qu'un compte admin existe déjà (§2 du master prompt).
// ------------------------------------------------------------------
export async function bootstrapAdmin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const nom = String(formData.get("nom") || "").trim();
  const prenom = String(formData.get("prenom") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!nom || !prenom || !email || password.length < 8) {
    return { error: "Merci de renseigner tous les champs (mot de passe : 8 caractères minimum)." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("bootstrap_admin", {
    p_email: email,
    p_password: password,
    p_nom: nom,
    p_prenom: prenom,
  });

  if (error) return { error: error.message };

  redirect("/login?bootstrap=ok");
}

// ------------------------------------------------------------------
// Création d'une invitation nominative (Partenaire par l'Admin, ou Porteur par un Partenaire/Admin).
// Si projet_id est fourni (invitation d'un porteur depuis une fiche projet), accept_invitation()
// ajoutera automatiquement la personne à membres_projet au moment où elle acceptera.
// ------------------------------------------------------------------
export async function createInvitation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const roleCible = String(formData.get("role_cible") || "") as InvitationRoleCible;
  const projetId = String(formData.get("projet_id") || "").trim();
  const nom = String(formData.get("nom") || "").trim();
  const prenom = String(formData.get("prenom") || "").trim();
  const organisation = String(formData.get("organisation") || "").trim();

  if (!email || !["partenaire", "porteur"].includes(roleCible)) {
    return { error: "Email et rôle cible requis." };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      email,
      role_cible: roleCible,
      id_emetteur: user.id,
      projet_id: projetId || null,
      nom: nom || null,
      prenom: prenom || null,
      organisation: organisation || null,
    })
    .select("token")
    .single();

  if (error) {
    return {
      error:
        "Impossible de créer l'invitation (droits insuffisants ou " + error.message + ").",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/invitations");
  if (projetId) revalidatePath(`/projets/${projetId}`);
  return { success: true, inviteUrl: `${APP_URL}/invite/${data.token}` };
}

// ------------------------------------------------------------------
// Création d'une fiche projet par un Partenaire (ou l'Admin), qui en devient le référent.
// Pas de workflow de validation en V0 (§10 du master prompt) : le projet est actif directement.
// ------------------------------------------------------------------
export async function createProjet(_prev: ActionResult, formData: FormData): Promise<ActionResult & { projetId?: string }> {
  const titre = String(formData.get("titre") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!titre) {
    return { error: "Le titre du projet est requis." };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data, error } = await supabase
    .from("projets")
    .insert({
      titre,
      description: description || null,
      etat: "en_cours",
      id_partenaire_createur: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Impossible de créer le projet (droits insuffisants ou " + error.message + ")." };
  }

  revalidatePath("/projets");
  redirect(`/projets/${data.id}`);
}

// ------------------------------------------------------------------
// Changement d'état d'un projet par son référent (ou l'admin). Passe par la RLS normale
// (projets_update : admin, ou référent via is_project_referent()).
// ------------------------------------------------------------------
export async function updateProjetEtat(projetId: string, etat: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase.from("projets").update({ etat }).eq("id", projetId);
  revalidatePath(`/projets/${projetId}`);
  revalidatePath("/projets");
}

// ------------------------------------------------------------------
// Étapes du "passeport projet" : ajout par le référent (ou l'admin), passe par la RLS
// etapes_projet_write (admin ou is_project_referent()).
// ------------------------------------------------------------------
export async function createEtape(projetId: string, titre: string): Promise<void> {
  const texte = titre.trim();
  if (!texte) return;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { count } = await supabase
    .from("etapes_projet")
    .select("id", { count: "exact", head: true })
    .eq("projet_id", projetId);
  await supabase.from("etapes_projet").insert({
    projet_id: projetId,
    titre: texte,
    ordre: count ?? 0,
  });
  revalidatePath(`/projets/${projetId}`);

  if (user) {
    await notifyProjectTeam(supabase, projetId, user.id, "etape_ajoutee", `Nouvelle étape : « ${texte} »`);
  }
}

// ------------------------------------------------------------------
// Validation/refus d'une étape par le référent (ou l'admin) — avis facultatif.
// ------------------------------------------------------------------
export async function updateEtapeStatut(
  projetId: string,
  etapeId: string,
  statut: string,
  avis?: string
): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isTerminal = statut === "validee" || statut === "refusee";
  const { data: etape } = await supabase
    .from("etapes_projet")
    .update({
      statut,
      avis: avis?.trim() || null,
      id_partenaire_validateur: isTerminal ? user?.id ?? null : null,
      date_validation: isTerminal ? new Date().toISOString() : null,
    })
    .eq("id", etapeId)
    .select("titre")
    .single();
  revalidatePath(`/projets/${projetId}`);

  if (isTerminal && user && etape) {
    const label = statut === "validee" ? "validée" : "refusée";
    await notifyProjectTeam(supabase, projetId, user.id, "etape_statut", `Étape « ${etape.titre} » ${label}`);
  }
}

// ------------------------------------------------------------------
// Notifications in-app : diffusion aux membres d'un projet (référent, partenaires additionnels,
// porteurs), à l'exclusion de l'auteur de l'action. Insertion permissive côté RLS
// (notifications_insert : authenticated, with check true) car le contenu est entièrement
// maîtrisé par ces server actions sur une plateforme fermée.
// ------------------------------------------------------------------
async function notifyProjectTeam(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  projetId: string,
  excludeUserId: string,
  type: string,
  titre: string
): Promise<void> {
  const [{ data: projet }, { data: membres }, { data: partenaires }] = await Promise.all([
    supabase.from("projets").select("id_partenaire_createur").eq("id", projetId).maybeSingle(),
    supabase.from("membres_projet").select("user_id").eq("projet_id", projetId),
    supabase.from("projet_partenaire").select("partenaire_id").eq("projet_id", projetId),
  ]);

  const ids = new Set<string>();
  if (projet?.id_partenaire_createur) ids.add(projet.id_partenaire_createur);
  membres?.forEach((m) => ids.add(m.user_id));
  partenaires?.forEach((p) => ids.add(p.partenaire_id));
  ids.delete(excludeUserId);

  if (!ids.size) return;

  await supabase.from("notifications").insert(
    Array.from(ids).map((user_id) => ({
      user_id,
      type,
      titre,
      lien: `/projets/${projetId}`,
    }))
  );
}

// ------------------------------------------------------------------
// Messagerie de projet : fil d'échange collectif rattaché à la fiche projet. Passe par la RLS
// messages_projet_insert (admin/partenaire, ou membre du projet via is_project_member()) —
// donc accessible à toute l'équipe, pas seulement au référent.
// ------------------------------------------------------------------
export async function createMessageProjet(projetId: string, contenu: string): Promise<void> {
  const texte = contenu.trim();
  if (!texte) return;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("messages_projet").insert({
    projet_id: projetId,
    auteur_id: user.id,
    contenu: texte,
  });
  if (error) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nom, prenom")
    .eq("id", user.id)
    .maybeSingle();
  const auteur = profile ? `${profile.prenom} ${profile.nom}` : "Un membre du projet";

  await notifyProjectTeam(supabase, projetId, user.id, "message_projet", `${auteur} a écrit dans le fil du projet`);
  revalidatePath(`/projets/${projetId}`);
}

// ------------------------------------------------------------------
// Marquage des notifications comme lues (RLS notifications_update : user_id = auth.uid()).
// ------------------------------------------------------------------
export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase.from("notifications").update({ lu: true }).eq("id", id);
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ lu: true }).eq("user_id", user.id).eq("lu", false);
  revalidatePath("/notifications");
}

// ------------------------------------------------------------------
// Upload vers le bucket de stockage unique "arcinnolab-media" (logos de projet, avatars, pièces
// jointes). Lecture publique, écriture réservée aux utilisateurs authentifiés (cf. migration 006).
// ------------------------------------------------------------------
async function uploadToMedia(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  file: File,
  folder: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("arcinnolab-media")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from("arcinnolab-media").getPublicUrl(path);
  return data.publicUrl;
}

// ------------------------------------------------------------------
// Photo de profil (avatar) — visible dans l'équipe projet, l'annuaire et la messagerie directe.
// ------------------------------------------------------------------
export async function updateProfilePhoto(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return { error: "Choisissez une image." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const url = await uploadToMedia(supabase, file, `avatars/${user.id}`);
  if (!url) return { error: "Échec de l'envoi de l'image." };

  const { error } = await supabase.from("profiles").update({ photo_url: url }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// ------------------------------------------------------------------
// Logo d'un projet — réservé au référent (ou admin), passe par la RLS projets_update.
// ------------------------------------------------------------------
export async function updateProjetLogo(projetId: string, formData: FormData): Promise<void> {
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return;

  const supabase = await createServerClient();
  const url = await uploadToMedia(supabase, file, `logos-projet/${projetId}`);
  if (!url) return;

  await supabase.from("projets").update({ logo_url: url }).eq("id", projetId);
  revalidatePath(`/projets/${projetId}`);
  revalidatePath("/projets");
}

// ------------------------------------------------------------------
// Sous-fil de discussion et pièces jointes rattachés à une étape précise du passeport projet
// (mêmes droits que la messagerie de projet : toute l'équipe, pas seulement le référent).
// ------------------------------------------------------------------
export async function createEtapeMessage(projetId: string, etapeId: string, contenu: string): Promise<void> {
  const texte = contenu.trim();
  if (!texte) return;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("messages_projet")
    .insert({ projet_id: projetId, etape_id: etapeId, auteur_id: user.id, contenu: texte });
  if (error) return;

  const { data: etape } = await supabase.from("etapes_projet").select("titre").eq("id", etapeId).maybeSingle();
  await notifyProjectTeam(
    supabase,
    projetId,
    user.id,
    "message_etape",
    `Nouveau message sur l'étape « ${etape?.titre ?? ""} »`
  );
  revalidatePath(`/projets/${projetId}/etapes/${etapeId}`);
}

export async function addEtapeDocument(projetId: string, etapeId: string, formData: FormData): Promise<void> {
  const file = formData.get("fichier") as File | null;
  if (!file || file.size === 0) return;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const url = await uploadToMedia(supabase, file, `documents/${projetId}`);
  if (!url) return;

  await supabase.from("documents").insert({
    projet_id: projetId,
    etape_id: etapeId,
    type: file.type || "fichier",
    nom_fichier: file.name,
    lien_fichier: url,
    uploaded_by: user.id,
  });

  const { data: etape } = await supabase.from("etapes_projet").select("titre").eq("id", etapeId).maybeSingle();
  await notifyProjectTeam(
    supabase,
    projetId,
    user.id,
    "document_ajoute",
    `Nouveau fichier sur l'étape « ${etape?.titre ?? ""} »`
  );
  revalidatePath(`/projets/${projetId}/etapes/${etapeId}`);
}

// ------------------------------------------------------------------
// Messagerie directe 1:1 (table "messages" du schéma initial, RLS déjà en place : chacun ne voit
// que ses propres conversations, l'admin voit tout).
// ------------------------------------------------------------------
export async function sendDirectMessage(destinataireId: string, contenu: string): Promise<void> {
  const texte = contenu.trim();
  if (!texte || !destinataireId) return;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === destinataireId) return;

  const { error } = await supabase
    .from("messages")
    .insert({ expediteur_id: user.id, destinataire_id: destinataireId, contenu: texte });
  if (error) return;

  await supabase.from("notifications").insert({
    user_id: destinataireId,
    type: "message_direct",
    titre: "Nouveau message",
    lien: `/messages/${user.id}`,
  });

  revalidatePath(`/messages/${destinataireId}`);
  revalidatePath("/messages");
}

export async function markConversationRead(otherUserId: string): Promise<void> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("messages")
    .update({ lu: true })
    .eq("destinataire_id", user.id)
    .eq("expediteur_id", otherUserId)
    .eq("lu", false);
  revalidatePath("/messages");
}

// ------------------------------------------------------------------
// Annulation d'une invitation en attente.
// ------------------------------------------------------------------
export async function cancelInvitation(invitationId: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase.from("invitations").update({ statut: "annulee" }).eq("id", invitationId);
  revalidatePath("/admin");
  revalidatePath("/invitations");
}

// ------------------------------------------------------------------
// Acceptation d'une invitation : passe par la fonction SQL accept_invitation() (SECURITY
// DEFINER, clé anon) qui valide le token/l'expiration et crée le compte Auth — la personne
// invitée n'a pas encore de session, donc pas de clé service_role nécessaire ici non plus.
// ------------------------------------------------------------------
export async function acceptInvitation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") || "");
  const nom = String(formData.get("nom") || "").trim();
  const prenom = String(formData.get("prenom") || "").trim();
  const organisation = String(formData.get("organisation") || "").trim();
  const password = String(formData.get("password") || "");

  if (!token || !nom || !prenom || password.length < 8) {
    return { error: "Merci de renseigner tous les champs (mot de passe : 8 caractères minimum)." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    p_password: password,
    p_nom: nom,
    p_prenom: prenom,
    p_organisation: organisation,
  });

  if (error) return { error: error.message };

  redirect("/login?invite=ok");
}

// ------------------------------------------------------------------
// Déconnexion
// ------------------------------------------------------------------
export async function logout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ══════════════════════════════════════════════════════════════════════════
// Accueil & orientation
//
// La démarche ArcInnoLab fait tourner deux services sur deux horloges : un
// accueil permanent où le coach oriente seul, et un accompagnement en
// promotion annuelle dont le comité mixte décide. Le comité ne siégeant
// qu'une fois par an, l'orientation est le service principal onze mois sur
// douze — elle ne doit donc jamais dépendre de lui.
// ══════════════════════════════════════════════════════════════════════════

/**
 * Dépôt d'une demande d'accueil. **Seul point de la plateforme ouvert sans
 * compte** : un guichet où il faut être invité n'est pas un guichet. La
 * plateforme reste fermée pour autant — c'est un coach qui invite ensuite,
 * une fois la demande qualifiée.
 *
 * La policy RLS n'autorise à `anon` que l'insertion : rien ne peut être relu.
 */
export async function deposerDemande(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const nom = String(formData.get("nom") || "").trim();
  const prenom = String(formData.get("prenom") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const telephone = String(formData.get("telephone") || "").trim();
  const organisation = String(formData.get("organisation") || "").trim();
  const pays = String(formData.get("pays") || "").trim();
  const titreProjet = String(formData.get("titre_projet") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!nom || !prenom || !email || !titreProjet || !description) {
    return { error: "Merci de renseigner tous les champs obligatoires." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Cette adresse email ne semble pas valide." };
  }
  if (pays !== "france" && pays !== "suisse") {
    return { error: "Merci d'indiquer où se situe votre projet." };
  }
  // Garde-fou anti-dépôt accidentel plus qu'anti-spam : une description d'une
  // ligne ne permet à personne de préparer un rendez-vous d'accueil utile.
  if (description.length < 40) {
    return {
      error:
        "Décrivez votre projet un peu plus longuement (quelques phrases) : c'est ce qui permet de vous orienter vers la bonne personne.",
    };
  }

  // Le jeton de suivi est engendré ici plutôt que laissé au défaut de la base :
  // le dépôt se fait sans session, et la RLS interdit à `anon` de relire la
  // ligne insérée. Sans cela, impossible de remettre son lien au porteur.
  const tokenSuivi = crypto.randomUUID();

  const supabase = await createServerClient();
  const { error } = await supabase.from("demandes_accueil").insert({
    nom,
    prenom,
    email,
    telephone: telephone || null,
    organisation: organisation || null,
    pays,
    titre_projet: titreProjet,
    description,
    token_suivi: tokenSuivi,
  });

  if (error) {
    return { error: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant." };
  }

  revalidatePath("/demandes");
  return { success: true, suiviUrl: `${APP_URL}/suivi/${tokenSuivi}` };
}

/**
 * Prise en charge d'une demande par un coach. Le fait de s'attribuer une
 * demande est ce qui évite qu'elle reste sans réponse : tant que personne ne
 * s'en saisit, elle reste « nouvelle » et remonte en tête de file.
 */
export async function prendreEnCharge(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  if (!demandeId) return { error: "Demande introuvable." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase
    .from("demandes_accueil")
    .update({ coach_id: user.id, statut: "en_accueil" })
    .eq("id", demandeId);

  if (error) return { error: "Prise en charge impossible : " + error.message };

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/**
 * Qualification : le coach renseigne le persona et ses notes après le rendez-vous
 * d'accueil. Le persona n'est pas décoratif — c'est lui qui indique quel pack de
 * services a du sens, et quatre des six profils n'ont pas besoin d'une promotion.
 */
export async function qualifierDemande(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  const persona = String(formData.get("persona") || "").trim();
  const notes = String(formData.get("notes_coach") || "").trim();
  if (!demandeId) return { error: "Demande introuvable." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("demandes_accueil")
    .update({ persona: persona || null, notes_coach: notes || null })
    .eq("id", demandeId);

  if (error) return { error: "Enregistrement impossible : " + error.message };

  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/**
 * Orientation : la voie rapide. Le coach met en relation et trace l'issue.
 * Tracer l'issue n'est pas de la bureaucratie : sans elle, personne ne sait si
 * la mise en relation a produit quelque chose, et le manifeste promet qu'un
 * porteur « n'est jamais seul ».
 */
export async function orienterDemande(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  const structure = String(formData.get("structure") || "").trim();
  const motif = String(formData.get("motif") || "").trim();
  const dateRelance = String(formData.get("date_relance") || "").trim();
  if (!demandeId || !structure) {
    return { error: "Indiquez au moins vers quelle structure vous orientez." };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase.from("orientations").insert({
    demande_id: demandeId,
    structure,
    motif: motif || null,
    date_relance: dateRelance || null,
    cree_par: user.id,
  });

  if (error) return { error: "Orientation non enregistrée : " + error.message };

  // Une demande orientée est traitée, mais le suivi de l'issue continue.
  await supabase.from("demandes_accueil").update({ statut: "orientee" }).eq("id", demandeId);

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/** Mise à jour de l'issue d'une orientation, lors de la relance. */
export async function majIssueOrientation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const orientationId = String(formData.get("orientation_id") || "");
  const demandeId = String(formData.get("demande_id") || "");
  const issue = String(formData.get("issue") || "");
  if (!orientationId || !issue) return { error: "Orientation introuvable." };

  const supabase = await createServerClient();
  const { error } = await supabase.from("orientations").update({ issue }).eq("id", orientationId);
  if (error) return { error: "Mise à jour impossible : " + error.message };

  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/**
 * Versement à une promotion : la voie longue. Le comité mixte ne siégeant
 * qu'une fois par an, la demande entre ici dans une file d'attente qui peut
 * durer des mois. C'est précisément pour ça que le porteur doit pouvoir savoir
 * quand siège le prochain comité.
 */
export async function verserEnPromotion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  const promotionId = String(formData.get("promotion_id") || "");
  if (!demandeId || !promotionId) return { error: "Sélectionnez une promotion." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("demandes_accueil")
    .update({ promotion_id: promotionId, statut: "en_attente_comite" })
    .eq("id", demandeId);

  if (error) return { error: "Enregistrement impossible : " + error.message };

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/** Décision du comité, ou clôture d'une demande sans suite. */
export async function deciderDemande(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  const statut = String(formData.get("statut") || "");
  const permis = ["admise", "non_retenue", "close", "en_accueil"];
  if (!demandeId || !permis.includes(statut)) return { error: "Décision invalide." };

  const supabase = await createServerClient();
  const { error } = await supabase.from("demandes_accueil").update({ statut }).eq("id", demandeId);
  if (error) return { error: "Décision non enregistrée : " + error.message };

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/** Création d'une promotion (réservée à l'Admin par la RLS). */
export async function creerPromotion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const nom = String(formData.get("nom") || "").trim();
  const dateComite = String(formData.get("date_comite") || "").trim();
  if (!nom) return { error: "Donnez un nom à la promotion." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("promotions")
    .insert({ nom, date_comite: dateComite || null });

  if (error) return { error: "Création impossible : " + error.message };

  revalidatePath("/demandes");
  revalidatePath("/admin");
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// Instruction collégiale : le tour de vote
//
// Le vote PRÉPARE le comité, il ne décide pas à sa place : clore un tour ne
// prononce aucune décision, cela produit un avis. La décision reste un geste
// explicite, posé par un humain, dans un second temps.
// ══════════════════════════════════════════════════════════════════════════

/** Ouvre une consultation de cinq jours auprès des partenaires. */
export async function ouvrirTourVote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  const promotionId = String(formData.get("promotion_id") || "");
  if (!demandeId) return { error: "Demande introuvable." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // Un tour déjà ouvert sur la même demande rendrait les avis ininterprétables.
  const { data: dejaOuvert } = await supabase
    .from("tours_vote")
    .select("id")
    .eq("demande_id", demandeId)
    .in("statut", ["en_cours", "complet"])
    .maybeSingle();

  if (dejaOuvert) {
    return { error: "Une consultation est déjà ouverte sur cette demande." };
  }

  // Le nombre de votants attendus est figé maintenant : un partenaire qui
  // rejoindrait la plateforme en cours de route ne doit pas rendre incomplet
  // un tour qui ne l'était pas.
  const { data: attendus } = await supabase.rpc("nb_votants_attendus");

  const { error } = await supabase.from("tours_vote").insert({
    demande_id: demandeId,
    promotion_id: promotionId || null,
    ouvert_par: user.id,
    votants_attendus: attendus ?? 1,
  });

  if (error) return { error: "Ouverture impossible : " + error.message };

  await supabase
    .from("demandes_accueil")
    .update({ statut: "en_instruction" })
    .eq("id", demandeId);

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/**
 * Enregistre ou met à jour l'avis de la personne connectée.
 * Un avis défavorable exige un motif — la base le vérifie aussi, parce que
 * c'est une règle de fond et non une validation de formulaire.
 */
export async function voter(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const tourId = String(formData.get("tour_id") || "");
  const demandeId = String(formData.get("demande_id") || "");
  const position = String(formData.get("position") || "");
  const motif = String(formData.get("motif") || "").trim();

  if (!tourId || !["favorable", "defavorable", "abstention"].includes(position)) {
    return { error: "Avis invalide." };
  }
  if (position === "defavorable" && motif.length < 10) {
    return {
      error:
        "Un avis défavorable doit être motivé : c'est ce motif qui permettra d'expliquer la décision au porteur.",
    };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase
    .from("votes")
    .upsert(
      { tour_id: tourId, votant_id: user.id, position, motif: motif || null },
      { onConflict: "tour_id,votant_id" }
    );

  if (error) return { error: "Avis non enregistré : " + error.message };

  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/**
 * Clôt la consultation et rédige le brouillon de message.
 *
 * Deux cas de clôture : tous les avis sont rendus, ou l'échéance est passée et
 * l'admin constate les absences. Le second existe parce que la règle « tous
 * doivent voter » bloquerait sinon le porteur indéfiniment — ce que le
 * manifeste promet précisément d'éviter.
 */
export async function cloreTourVote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const tourId = String(formData.get("tour_id") || "");
  const demandeId = String(formData.get("demande_id") || "");
  const decision = String(formData.get("decision") || "");
  if (!tourId || !["admise", "non_retenue"].includes(decision)) {
    return { error: "Indiquez le sens de la décision." };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data: tour } = await supabase
    .from("tours_vote")
    .select("*")
    .eq("id", tourId)
    .single();

  if (!tour) return { error: "Consultation introuvable." };

  const { data: votes } = await supabase
    .from("votes")
    .select("position, motif")
    .eq("tour_id", tourId);

  const exprimes = votes ?? [];
  if (exprimes.length === 0) {
    return { error: "Aucun avis n'a été exprimé : il n'y a rien à synthétiser." };
  }

  const { data: demande } = await supabase
    .from("demandes_accueil")
    .select("titre_projet")
    .eq("id", demandeId)
    .single();

  const { redigerMessagePorteur } = await import("@/lib/redaction-avis");
  const redaction = await redigerMessagePorteur({
    titreProjet: demande?.titre_projet ?? "votre projet",
    decision: decision as "admise" | "non_retenue",
    avis: exprimes.map((v) => ({ position: v.position, motif: v.motif })),
    absents: Math.max(0, (tour.votants_attendus ?? 0) - exprimes.length),
  });

  const { error } = await supabase
    .from("tours_vote")
    .update({
      statut: "clos",
      clos_le: new Date().toISOString(),
      clos_par: user.id,
      synthese: redaction.texte,
      synthese_le: new Date().toISOString(),
      synthese_par_ia: redaction.parIA,
    })
    .eq("id", tourId);

  if (error) return { error: "Clôture impossible : " + error.message };

  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/**
 * Prononce la décision et publie le message que lira le porteur.
 *
 * C'est le seul endroit où un texte devient visible à l'extérieur, et il passe
 * toujours par un champ modifiable : ce qui part a été relu par quelqu'un.
 */
export async function prononcerDecision(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  const statut = String(formData.get("statut") || "");
  const message = String(formData.get("message_porteur") || "").trim();

  if (!demandeId || !["admise", "non_retenue"].includes(statut)) {
    return { error: "Décision invalide." };
  }
  if (statut === "non_retenue" && message.length < 30) {
    return {
      error:
        "Un refus doit être expliqué au porteur. Rédigez le message avant de prononcer la décision.",
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("demandes_accueil")
    .update({ statut, message_porteur: message || null })
    .eq("id", demandeId);

  if (error) return { error: "Décision non enregistrée : " + error.message };

  revalidatePath("/demandes");
  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// Échanges avec le porteur, et gestion des accès
// ══════════════════════════════════════════════════════════════════════════

/** Réponse de l'équipe au porteur, depuis la fiche de traitement. */
export async function repondreAuPorteur(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const demandeId = String(formData.get("demande_id") || "");
  const contenu = String(formData.get("contenu") || "").trim();
  if (!demandeId || contenu.length < 2) return { error: "Message vide." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase.from("messages_demande").insert({
    demande_id: demandeId,
    auteur: "equipe",
    auteur_id: user.id,
    contenu,
    lu_par_equipe: true,
  });

  if (error) return { error: "Message non envoyé : " + error.message };

  revalidatePath(`/demandes/${demandeId}`);
  return { success: true };
}

/**
 * Message écrit par le porteur depuis sa page de suivi.
 * Il n'a pas de compte : son jeton tient lieu d'authentification, et la
 * fonction Postgres le vérifie elle-même.
 */
export async function posterMessageSuivi(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") || "");
  const contenu = String(formData.get("contenu") || "").trim();
  if (!token) return { error: "Lien de suivi invalide." };
  if (contenu.length < 2) return { error: "Écrivez votre message avant de l'envoyer." };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("poster_message_porteur", {
    p_token: token,
    p_contenu: contenu,
  });

  if (error) return { error: "Message non envoyé. Réessayez dans un instant." };

  revalidatePath(`/suivi/${token}`);
  return { success: true };
}

/**
 * Engendre un lien de réinitialisation pour un membre de l'équipe.
 *
 * Faute de service d'envoi d'e-mails, un mot de passe oublié serait sans issue.
 * L'administrateur transmet ce lien par le moyen de son choix ; la personne
 * choisit elle-même son nouveau mot de passe, que personne d'autre ne voit.
 */
export async function creerLienReinitialisation(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const userId = String(formData.get("user_id") || "");
  if (!userId) return { error: "Compte introuvable." };

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data, error } = await supabase
    .from("reinitialisations")
    .insert({ user_id: userId, cree_par: user.id })
    .select("token")
    .single();

  if (error) return { error: "Création impossible : " + error.message };

  revalidatePath("/admin");
  return { success: true, inviteUrl: `${APP_URL}/reinitialiser/${data.token}` };
}

/** Application du nouveau mot de passe par la personne elle-même. */
export async function appliquerReinitialisation(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  if (!token) return { error: "Lien invalide." };
  if (password.length < 8) return { error: "Mot de passe trop court (8 caractères minimum)." };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("appliquer_reinitialisation", {
    p_token: token,
    p_password: password,
  });

  if (error) return { error: error.message };

  redirect("/login?reinitialise=ok");
}

/** Change le rôle d'un compte. Réservé à l'admin par la RLS et le trigger. */
export async function changerRole(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "");
  if (!userId || !["admin", "partenaire", "porteur"].includes(role)) {
    return { error: "Rôle invalide." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: "Changement impossible : " + error.message };

  revalidatePath("/admin");
  return { success: true };
}

// ------------------------------------------------------------------
// Fiche d'étape : titre, description, échéance.
//
// Ouvert au porteur autant qu'au référent (RLS etapes_projet_update, migration
// 016). Ce qui reste fermé, c'est la validation : un trigger refuse à
// quiconque n'est pas référent de faire passer une étape en « validée » ou
// « refusée ». Sans ce partage, le plan de travail du porteur restait la
// propriété de son accompagnateur, et chaque date à corriger passait par lui.
// ------------------------------------------------------------------
export async function updateEtape(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const projetId = String(formData.get("projet_id") || "");
  const etapeId = String(formData.get("etape_id") || "");
  const titre = String(formData.get("titre") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const echeance = String(formData.get("date_echeance") || "").trim();

  if (!projetId || !etapeId) return { error: "Étape introuvable." };
  if (titre.length < 2) return { error: "Donnez un titre à cette étape." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("etapes_projet")
    .update({
      titre,
      description: description || null,
      date_echeance: echeance || null,
    })
    .eq("id", etapeId);

  if (error) return { error: error.message };

  revalidatePath(`/projets/${projetId}`);
  revalidatePath(`/projets/${projetId}/etapes/${etapeId}`);
  return { success: true };
}

/** Suppression d'une étape. La RLS refuse celles déjà tranchées au porteur. */
export async function deleteEtape(projetId: string, etapeId: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase.from("etapes_projet").delete().eq("id", etapeId);
  revalidatePath(`/projets/${projetId}`);
}

/**
 * Descriptif du projet, modifiable par le porteur comme par le référent.
 * C'est son projet : il est le mieux placé pour le raconter, et un descriptif
 * qu'il ne peut pas corriger vieillit sans que personne s'en aperçoive.
 */
export async function updateProjetDescription(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const projetId = String(formData.get("projet_id") || "");
  const description = String(formData.get("description") || "").trim();
  if (!projetId) return { error: "Projet introuvable." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("projets")
    .update({ description: description || null })
    .eq("id", projetId);

  if (error) return { error: error.message };

  revalidatePath(`/projets/${projetId}`);
  return { success: true };
}

/**
 * Rattachement d'un partenaire à un projet.
 *
 * Ce rattachement n'est pas décoratif : depuis la migration 016, c'est lui qui
 * décide qui le porteur voit et à qui il peut écrire. Rattacher tout le
 * consortium à chaque projet reviendrait à rouvrir l'annuaire.
 */
export async function rattacherPartenaire(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const projetId = String(formData.get("projet_id") || "");
  const partenaireId = String(formData.get("partenaire_id") || "");
  if (!projetId || !partenaireId) return { error: "Sélectionnez un partenaire." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("projet_partenaire")
    .insert({ projet_id: projetId, partenaire_id: partenaireId });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Ce partenaire est déjà rattaché au projet."
        : "Rattachement impossible : " + error.message,
    };
  }

  revalidatePath(`/projets/${projetId}`);
  return { success: true };
}

export async function detacherPartenaire(projetId: string, partenaireId: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase
    .from("projet_partenaire")
    .delete()
    .eq("projet_id", projetId)
    .eq("partenaire_id", partenaireId);
  revalidatePath(`/projets/${projetId}`);
}
