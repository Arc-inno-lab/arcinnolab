"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvitationRoleCible } from "@/lib/types";

type ActionResult = { error?: string; success?: boolean; inviteUrl?: string };

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// ------------------------------------------------------------------
// Bootstrap : création du tout premier compte Admin.
// Bloqué dès qu'un compte admin existe déjà (plateforme fermée, §2 du master prompt).
// ------------------------------------------------------------------
export async function bootstrapAdmin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const nom = String(formData.get("nom") || "").trim();
  const prenom = String(formData.get("prenom") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!nom || !prenom || !email || password.length < 8) {
    return { error: "Merci de renseigner tous les champs (mot de passe : 8 caractères minimum)." };
  }

  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (countError) return { error: "Erreur serveur : " + countError.message };
  if (count && count > 0) {
    return { error: "Un compte administrateur existe déjà. Le bootstrap est désactivé." };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom, prenom, role: "admin" },
  });

  if (createError) return { error: "Erreur lors de la création du compte : " + createError.message };

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
  return { success: true, inviteUrl: `${appUrl()}/invite/${data.token}` };
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
// Acceptation d'une invitation : le compte n'existe pas encore, on utilise le client service_role.
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

  const admin = createAdminClient();

  const { data: invitation, error: invError } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (invError || !invitation) return { error: "Invitation introuvable." };
  if (invitation.statut !== "en_attente") return { error: "Cette invitation n'est plus valide." };
  if (new Date(invitation.date_expiration) < new Date()) {
    await admin.from("invitations").update({ statut: "expiree" }).eq("id", invitation.id);
    return { error: "Cette invitation a expiré. Demandez à votre référent d'en générer une nouvelle." };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: {
      nom,
      prenom,
      role: invitation.role_cible,
      organisation: organisation || null,
    },
  });

  if (createError) return { error: "Erreur lors de la création du compte : " + createError.message };

  if (invitation.projet_id && invitation.role_cible === "porteur" && created.user) {
    await admin
      .from("membres_projet")
      .insert({ projet_id: invitation.projet_id, user_id: created.user.id });
  }

  await admin.from("invitations").update({ statut: "acceptee" }).eq("id", invitation.id);

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
