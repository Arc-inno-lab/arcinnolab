import type { createClient } from "@/lib/supabase/server";
import type { LigneHistorique } from "@/components/HistoriqueDemande";

type Client = Awaited<ReturnType<typeof createClient>>;

function quand(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });
}

/**
 * L'historique de la demande qui a donné naissance au projet (migration 027).
 * Les documents s'ouvrent par un lien signé d'une heure : l'espace de stockage
 * est privé, et le membre du projet y a droit.
 */
export async function chargerHistorique(supabase: Client, projetId: string): Promise<LigneHistorique[]> {
  const { data, error } = await supabase.rpc("historique_demande_projet", { p_projet: projetId });
  if (error || !data) return [];
  const lignes = data as { genre: LigneHistorique["genre"]; auteur: string; contenu: string; chemin: string | null; taille: number | null; quand: string }[];
  const chemins = lignes.filter((l) => l.genre === "document" && l.chemin).map((l) => l.chemin as string);
  const { data: signes } = chemins.length
    ? await supabase.storage.from("demandes-documents").createSignedUrls(chemins, 3600)
    : { data: [] };
  const urls = new Map((signes ?? []).map((s) => [s.path, s.signedUrl]));
  return lignes.map((l) => ({
    genre: l.genre,
    auteur: l.auteur,
    contenu: l.contenu,
    quand: quand(l.quand),
    taille: l.taille,
    url: l.chemin ? (urls.get(l.chemin) ?? null) : null,
  }));
}
