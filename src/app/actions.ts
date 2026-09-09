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
// ------------------------------------------------------------------
export async function createInvitation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const roleCible = String(formData.get("role_cible") || "") as InvitationRoleCible;

  if (!email || !["partenaire", "porteur"].includes(roleCible)) {
    return { error: "Email et rôle cible requis." };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data, error } = await supabase
    .from("invitations")
    .insert({ email, role_cible: roleCible, id_emetteur: user.id })
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
  return { success: true, inviteUrl: `${APP_URL}/invite/${data.token}` };
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
