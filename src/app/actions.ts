"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/config";
import type { InvitationRoleCible } from "@/lib/types";

type ActionResult = { error?: string; success?: boolean; inviteUrl?: string };

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
