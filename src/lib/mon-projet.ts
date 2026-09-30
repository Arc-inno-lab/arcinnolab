import type { createClient } from "@/lib/supabase/server";
import type { ColonneProjet, DocumentProjet, EtapeProjet, MessageProjet, Profile, Projet } from "@/lib/types";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Personne = Pick<Profile, "id" | "prenom" | "nom" | "organisation" | "photo_url">;

export type MonProjet = {
  projet: Projet;
  accompagnateur: Personne | null;
  partenaires: Personne[];
  colonnes: ColonneProjet[];
  etapes: EtapeProjet[];
  messages: MessageProjet[];
  documents: DocumentProjet[];
  autresProjets: { id: string; titre: string }[];
};

/**
 * Tout ce que voit un porteur de son projet, chargé en une fois. Le projet
 * affiché est celui demandé (?p=) s'il en est membre, sinon le plus récent :
 * un porteur n'a presque toujours qu'un projet, et ne doit pas avoir à le
 * choisir.
 */
export async function chargerMonProjet(
  supabase: Client,
  userId: string,
  projetDemande?: string
): Promise<MonProjet | null> {
  const { data: adhesions } = await supabase
    .from("membres_projet")
    .select("projet_id, date_ajout, projet:projets(id, titre)")
    .eq("user_id", userId)
    .order("date_ajout", { ascending: false });

  const liste = (adhesions ?? [])
    .map((a) => (Array.isArray(a.projet) ? a.projet[0] : a.projet) as { id: string; titre: string } | null)
    .filter((p): p is { id: string; titre: string } => Boolean(p));
  if (!liste.length) return null;

  const choisi = liste.find((p) => p.id === projetDemande) ?? liste[0];
  const id = choisi.id;

  const [{ data: projet }, { data: colonnes }, { data: etapes }, { data: messages }, { data: documents }, { data: liens }] =
    await Promise.all([
      supabase.from("projets").select("*").eq("id", id).maybeSingle<Projet>(),
      supabase.from("colonnes_projet").select("*").eq("projet_id", id).order("ordre").returns<ColonneProjet[]>(),
      supabase.from("etapes_projet").select("*").eq("projet_id", id).order("ordre").returns<EtapeProjet[]>(),
      supabase
        .from("messages_projet")
        .select("*, auteur:profiles(nom,prenom,role,photo_url)")
        .eq("projet_id", id)
        .is("etape_id", null)
        .order("created_at", { ascending: true })
        .returns<MessageProjet[]>(),
      supabase
        .from("documents")
        .select("*")
        .eq("projet_id", id)
        .order("date_upload", { ascending: false })
        .returns<DocumentProjet[]>(),
      supabase
        .from("projet_partenaire")
        .select("profile:profiles(id, prenom, nom, organisation, photo_url)")
        .eq("projet_id", id),
    ]);

  if (!projet) return null;

  const { data: accompagnateur } = await supabase
    .from("profiles")
    .select("id, prenom, nom, organisation, photo_url")
    .eq("id", projet.id_partenaire_createur)
    .maybeSingle<Personne>();

  const partenaires = (liens ?? [])
    .map((l) => (Array.isArray(l.profile) ? l.profile[0] : l.profile) as Personne | null)
    .filter((p): p is Personne => Boolean(p) && p!.id !== projet.id_partenaire_createur);

  return {
    projet,
    accompagnateur: accompagnateur ?? null,
    partenaires,
    colonnes: colonnes ?? [],
    etapes: etapes ?? [],
    messages: messages ?? [],
    documents: documents ?? [],
    autresProjets: liste.filter((p) => p.id !== id),
  };
}
