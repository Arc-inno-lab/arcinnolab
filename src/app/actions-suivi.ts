"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Resultat = { error?: string; success?: boolean };

/**
 * Le porteur n'a pas de compte : son jeton de suivi tient lieu d'identité.
 * Toutes les vérifications (jeton valide, étape qui le permet, longueurs) se
 * font dans les fonctions Postgres ; on ne fait ici que relayer, et traduire
 * leurs refus en phrases lisibles.
 */
function message(error: { code?: string; message: string } | null, defaut: string) {
  if (!error) return undefined;
  // P0001 = refus écrit par nos fonctions, déjà formulé pour le porteur.
  return error.code === "P0001" ? error.message : defaut;
}

export async function modifierDemandeSuivi(_prev: Resultat, fd: FormData): Promise<Resultat> {
  const token = String(fd.get("token") || "");
  if (!token) return { error: "Lien de suivi invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("modifier_demande_porteur", {
    p_token: token,
    p_titre: String(fd.get("titre_projet") || ""),
    p_description: String(fd.get("description") || ""),
    p_organisation: String(fd.get("organisation") || ""),
    p_telephone: String(fd.get("telephone") || ""),
  });
  const erreur = message(error, "Modification non enregistrée. Réessayez dans un instant.");
  if (erreur) return { error: erreur };
  if (data === false) return { error: "Vous n'avez rien changé." };
  revalidatePath(`/suivi/${token}`);
  return { success: true };
}

/** Enregistre un document que le navigateur vient de déposer dans l'espace privé. */
export async function enregistrerDocumentSuivi(
  token: string,
  chemin: string,
  nom: string,
  taille: number,
  type: string
): Promise<Resultat> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajouter_document_porteur", {
    p_token: token,
    p_chemin: chemin,
    p_nom: nom,
    p_taille: taille,
    p_type: type || null,
  });
  const erreur = message(error, "Le document n'a pas pu être enregistré.");
  if (erreur) return { error: erreur };
  revalidatePath(`/suivi/${token}`);
  return { success: true };
}

export async function retirerDocumentSuivi(_prev: Resultat, fd: FormData): Promise<Resultat> {
  const token = String(fd.get("token") || "");
  const id = String(fd.get("document_id") || "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("retirer_document_porteur", { p_token: token, p_document: id });
  const erreur = message(error, "Le document n'a pas pu être retiré.");
  if (erreur) return { error: erreur };
  revalidatePath(`/suivi/${token}`);
  return { success: true };
}
