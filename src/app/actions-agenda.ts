"use server";

/**
 * L'agenda : l'équipe (administrateur et partenaires) publie les événements ;
 * la RLS vérifie que seul l'auteur ou l'administrateur modifie un événement.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { versInstantParis } from "@/lib/parcours";

type Resultat = { error?: string; success?: boolean; id?: string };

function rafraichir() {
  revalidatePath("/agenda");
  revalidatePath("/demande");
  revalidatePath("/mon-projet");
}

function texteOuNull(v: FormDataEntryValue | null, max: number) {
  const s = String(v || "").trim();
  return s ? s.slice(0, max) : null;
}

/** Crée ou modifie un événement selon qu'un identifiant est fourni. */
export async function enregistrerEvenement(_prev: Resultat, fd: FormData): Promise<Resultat> {
  const id = String(fd.get("id") || "");
  const titre = String(fd.get("titre") || "").trim();
  if (titre.length < 3) return { error: "Donnez un titre à l'événement (3 caractères au moins)." };
  if (titre.length > 160) return { error: "Le titre est trop long (160 caractères au plus)." };

  const jour = String(fd.get("jour") || "");
  const debut = versInstantParis(jour, String(fd.get("heure_debut") || ""));
  if (!debut) return { error: "Indiquez la date et l'heure de début." };

  const heureFin = String(fd.get("heure_fin") || "");
  const jourFin = String(fd.get("jour_fin") || "") || jour;
  const fin = heureFin ? versInstantParis(jourFin, heureFin) : null;
  if (heureFin && !fin) return { error: "L'heure de fin n'est pas valide." };
  if (fin && fin <= debut) return { error: "La fin doit venir après le début." };

  const lien = texteOuNull(fd.get("lien"), 500);
  if (lien && !/^https?:\/\//i.test(lien)) return { error: "Le lien doit commencer par https://" };

  const ligne = {
    titre,
    description: texteOuNull(fd.get("description"), 4000),
    debut,
    fin,
    lieu: texteOuNull(fd.get("lieu"), 200),
    lien,
    organisateur: texteOuNull(fd.get("organisateur"), 120),
    public: fd.get("public") === "on",
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée : reconnectez-vous." };

  const requete = id
    ? supabase.from("evenements").update(ligne).eq("id", id).select("id").single()
    : supabase.from("evenements").insert({ ...ligne, cree_par: user.id }).select("id").single();
  const { data, error } = await requete;
  if (error) {
    return {
      error:
        error.code === "42501" || error.code === "PGRST116"
          ? "Seuls l'auteur de l'événement et l'administrateur peuvent le modifier."
          : "Enregistrement impossible : " + error.message,
    };
  }
  rafraichir();
  return { success: true, id: data.id };
}

/** Annuler (reste visible, barré), rétablir, ou retirer de l'agenda. */
export async function changerEtatEvenement(_prev: Resultat, fd: FormData): Promise<Resultat> {
  const id = String(fd.get("id") || "");
  const geste = String(fd.get("geste") || "");
  const maj =
    geste === "annuler" ? { annule: true } : geste === "retablir" ? { annule: false } : geste === "retirer" ? { retire: true } : null;
  if (!id || !maj) return { error: "Action inconnue." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("evenements").update(maj).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Seuls l'auteur de l'événement et l'administrateur peuvent le modifier." };
  rafraichir();
  return { success: true };
}
