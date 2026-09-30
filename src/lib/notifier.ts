import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Prévient toutes les personnes rattachées à un projet — référent, partenaires
 * rattachés, porteurs — sauf l'auteur du geste.
 *
 * `seulementEquipe` restreint aux partenaires : utile pour ce qui n'appelle une
 * action que d'eux (une étape à valider), afin de ne pas encombrer le porteur
 * d'alertes sur ses propres gestes.
 */
export async function notifierProjet(
  supabase: Client,
  projetId: string,
  auteurId: string,
  type: string,
  titre: string,
  options: { seulementEquipe?: boolean; lien?: string } = {}
): Promise<void> {
  const [{ data: projet }, { data: membres }, { data: partenaires }] = await Promise.all([
    supabase.from("projets").select("id_partenaire_createur").eq("id", projetId).maybeSingle(),
    options.seulementEquipe
      ? Promise.resolve({ data: [] as { user_id: string }[] })
      : supabase.from("membres_projet").select("user_id").eq("projet_id", projetId),
    supabase.from("projet_partenaire").select("partenaire_id").eq("projet_id", projetId),
  ]);

  const ids = new Set<string>();
  if (projet?.id_partenaire_createur) ids.add(projet.id_partenaire_createur);
  membres?.forEach((m) => ids.add(m.user_id));
  partenaires?.forEach((p) => ids.add(p.partenaire_id));
  ids.delete(auteurId);
  if (!ids.size) return;

  await supabase.from("notifications").insert(
    Array.from(ids).map((user_id) => ({
      user_id,
      type,
      titre,
      lien: options.lien ?? `/projets/${projetId}`,
    }))
  );
}
