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
