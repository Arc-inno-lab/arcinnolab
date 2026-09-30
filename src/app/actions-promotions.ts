"use server";

/** Gestion des promotions (réservée à l'administrateur : la RLS le vérifie). */

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";

type Resultat = { error?: string; success?: boolean; id?: string };

function dateOuNull(v: FormDataEntryValue | null) {
  const s = String(v || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Crée ou modifie une promotion selon qu'un identifiant est fourni. */
export async function enregistrerPromotion(_prev: Resultat, formData: FormData): Promise<Resultat> {
  const id = String(formData.get("id") || "");
  const nom = String(formData.get("nom") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const placesTexte = String(formData.get("places") || "").trim();
  const places = placesTexte ? Number(placesTexte) : null;
  if (nom.length < 2) return { error: "Donnez un nom à la promotion." };
  if (places !== null && (!Number.isInteger(places) || places < 1 || places > 500)) {
    return { error: "Le nombre de places doit être un entier entre 1 et 500." };
  }
  const debut = dateOuNull(formData.get("date_debut"));
  const fin = dateOuNull(formData.get("date_fin"));
  if (debut && fin && fin < debut) return { error: "La fin de l'accompagnement précède son début." };

  const ligne = {
    nom,
    description: description || null,
    date_comite: dateOuNull(formData.get("date_comite")),
    date_debut: debut,
    date_fin: fin,
    places,
    ouverte: formData.get("ouverte") === "on",
  };

  const supabase = await createServerClient();
  const requete = id
    ? supabase.from("promotions").update(ligne).eq("id", id).select("id").single()
    : supabase.from("promotions").insert(ligne).select("id").single();
  const { data, error } = await requete;
  if (error) {
    return { error: error.code === "42501" || error.code === "PGRST116" ? "Seul un administrateur gère les promotions." : "Enregistrement impossible : " + error.message };
  }

  revalidatePath("/promotions");
  revalidatePath(`/promotions/${data.id}`);
  revalidatePath("/demandes");
  return { success: true, id: data.id };
}
