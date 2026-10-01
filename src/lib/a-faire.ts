import type { createClient } from "@/lib/supabase/server";
import type { ColonneProjet, EtapeProjet, UserRole } from "@/lib/types";
import { aujourdhuiIso, estEnRetard } from "@/lib/parcours";

type Client = Awaited<ReturnType<typeof createClient>>;

export type DemandeAFaire = {
  id: string;
  titre_projet: string;
  prenom: string;
  nom: string;
  organisation: string | null;
  pays: string;
  created_at: string;
  joursAttente: number;
};

export type AvisAFaire = {
  demandeId: string;
  titre: string;
  porteur: string;
  votes: number;
  attendus: number;
  joursRestants: number;
};

export type ElementProjetAFaire = {
  projetId: string;
  projetTitre: string;
  porteur: string | null;
  etapeId: string;
  titre: string;
  nature: "a_valider" | "en_retard" | "rdv_a_confirmer";
  detail: string;
  urgence: number;
};

/** Une demande que je dois faire avancer : la qualifier, ou trancher après le vote. */
export type SuiteAFaire = {
  id: string;
  titre: string;
  porteur: string;
  detail: string;
  action: string;
  ancre: string;
};

export type AFaire = {
  demandes: DemandeAFaire[];
  suites: SuiteAFaire[];
  avis: AvisAFaire[];
  projets: ElementProjetAFaire[];
  total: number;
};

const JOUR = 86_400_000;

/**
 * Ce qui attend une action de la personne connectée. C'est la seule question
 * à laquelle l'accueil doit répondre ; les compteurs d'avant (« 3 projets,
 * 1 partenaire ») n'appelaient aucun geste.
 *
 * Lecture de l'heure faite ici, hors de tout composant : elle fait partie du
 * chargement des données, pas du rendu.
 */
export async function chargerAFaire(supabase: Client, userId: string, role: UserRole): Promise<AFaire> {
  const vide: AFaire = { demandes: [], suites: [], avis: [], projets: [], total: 0 };
  if (role === "porteur") return vide;

  const maintenant = Date.now();
  const aujourdhui = aujourdhuiIso(maintenant);

  const [
    { data: demandes },
    { data: tours },
    { data: mesVotes },
    { data: tousProjets },
    { data: rattachements },
    { data: enCours },
    { data: toursClos },
  ] =
    await Promise.all([
      supabase
        .from("demandes_accueil")
        .select("id, titre_projet, prenom, nom, organisation, pays, created_at")
        .eq("statut", "nouvelle")
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("tours_vote")
        .select("id, demande_id, date_limite, votants_attendus, demande:demandes_accueil(titre_projet, prenom, nom), votes(count)")
        .eq("statut", "en_cours"),
      supabase.from("votes").select("tour_id").eq("votant_id", userId),
      supabase.from("projets").select("id, titre, id_partenaire_createur, etat"),
      supabase.from("projet_partenaire").select("projet_id").eq("partenaire_id", userId),
      supabase
        .from("demandes_accueil")
        .select("id, titre_projet, prenom, nom, statut, coach_id")
        .in("statut", ["en_accueil", "en_qualification", "en_attente_comite"])
        // Les miennes, et celles dont plus personne n'assure le suivi.
        .or(`coach_id.eq.${userId},coach_id.is.null`),
      role === "admin"
        ? supabase
            .from("tours_vote")
            .select("demande_id, statut, created_at, demande:demandes_accueil!inner(titre_projet, prenom, nom, statut)")
            .in("statut", ["en_cours", "complet", "clos"])
            .eq("demande.statut", "en_instruction")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const dejaVote = new Set((mesVotes ?? []).map((v) => v.tour_id as string));

  // Seul le vote le plus récent de chaque demande compte : un ancien vote
  // clos ne doit pas réclamer une décision quand un nouveau est en cours.
  const vus = new Set<string>();
  const derniersTours = (toursClos ?? []).filter((t) => {
    if (vus.has(t.demande_id as string)) return false;
    vus.add(t.demande_id as string);
    return t.statut === "clos";
  });

  const suites: SuiteAFaire[] = [
    ...derniersTours.map((t) => {
      const d = (Array.isArray(t.demande) ? t.demande[0] : t.demande) as { titre_projet: string; prenom: string; nom: string };
      return {
        id: t.demande_id as string,
        titre: d.titre_projet,
        porteur: `${d.prenom} ${d.nom}`,
        detail: "Vote clos : décision à prononcer",
        action: "Décider",
        ancre: "#decision",
      };
    }),
    ...(enCours ?? []).map((d) => ({
      id: d.id as string,
      titre: d.titre_projet as string,
      porteur: `${d.prenom} ${d.nom}`,
      detail: "À qualifier : appel au porteur, ADN et choix de la suite",
      action: "Qualifier",
      ancre: "#qualification",
    })),
  ];

  const resultat: AFaire = {
    suites,
    demandes: (demandes ?? []).map((d) => ({
      ...d,
      joursAttente: Math.floor((maintenant - new Date(d.created_at).getTime()) / JOUR),
    })),
    avis: (tours ?? [])
      .filter((t) => !dejaVote.has(t.id as string))
      .map((t) => {
        const demande = (Array.isArray(t.demande) ? t.demande[0] : t.demande) as
          | { titre_projet: string; prenom: string; nom: string }
          | null;
        const compte = Array.isArray(t.votes) ? (t.votes[0] as { count?: number } | undefined)?.count ?? 0 : 0;
        return {
          demandeId: t.demande_id as string,
          titre: demande?.titre_projet ?? "Candidature",
          porteur: demande ? `${demande.prenom} ${demande.nom}` : "",
          votes: compte,
          attendus: (t.votants_attendus as number) ?? 0,
          joursRestants: Math.ceil((new Date(t.date_limite as string).getTime() - maintenant) / JOUR),
        };
      }),
    projets: [],
    total: 0,
  };

  // Les projets qui me concernent : ceux dont je suis référent ou auxquels je
  // suis rattaché. L'administrateur les voit tous — c'est son rôle de repérer
  // ce qui patine.
  const miens = new Set((rattachements ?? []).map((r) => r.projet_id as string));
  const projets = (tousProjets ?? []).filter(
    (p) =>
      p.etat !== "termine" &&
      p.etat !== "archive" &&
      (role === "admin" || p.id_partenaire_createur === userId || miens.has(p.id))
  );

  if (projets.length) {
    const ids = projets.map((p) => p.id);
    const [{ data: etapes }, { data: colonnes }, { data: membres }] = await Promise.all([
      supabase.from("etapes_projet").select("*").in("projet_id", ids).returns<EtapeProjet[]>(),
      supabase.from("colonnes_projet").select("*").in("projet_id", ids).returns<ColonneProjet[]>(),
      supabase
        .from("membres_projet")
        .select("projet_id, user_id, profile:profiles(prenom, nom)")
        .in("projet_id", ids),
    ]);

    const terminales = new Set((colonnes ?? []).filter((c) => c.terminale).map((c) => c.id));
    const titres = new Map(projets.map((p) => [p.id, p.titre as string]));
    const porteurs = new Map<string, string>();
    // Les rendez-vous à confirmer sont ceux que propose un porteur : ceux
    // qu'un collègue propose attendent la réponse du porteur, pas la mienne.
    const idsPorteurs = new Set((membres ?? []).map((m) => m.user_id as string));
    for (const m of membres ?? []) {
      const p = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as { prenom: string; nom: string } | null;
      if (p && !porteurs.has(m.projet_id as string)) porteurs.set(m.projet_id as string, `${p.prenom} ${p.nom}`);
    }

    for (const e of etapes ?? []) {
      const base = {
        projetId: e.projet_id,
        projetTitre: titres.get(e.projet_id) ?? "",
        porteur: porteurs.get(e.projet_id) ?? null,
        etapeId: e.id,
        titre: e.titre,
      };
      if (e.type !== "rendez_vous" && e.validation === "a_valider") {
        resultat.projets.push({ ...base, nature: "a_valider", detail: "Marquée terminée, à valider", urgence: 1 });
      } else if (estEnRetard(e, terminales, aujourdhui)) {
        const jours = Math.max(
          1,
          Math.round((new Date(`${aujourdhui}T12:00:00Z`).getTime() - new Date(`${e.date_echeance}T12:00:00Z`).getTime()) / JOUR)
        );
        resultat.projets.push({
          ...base,
          nature: "en_retard",
          detail: jours === 1 ? "En retard d'un jour" : `En retard de ${jours} jours`,
          urgence: 0,
        });
      } else if (
        e.type === "rendez_vous" &&
        e.rdv_statut === "propose" &&
        !!e.cree_par &&
        idsPorteurs.has(e.cree_par) &&
        e.rdv_debut &&
        new Date(e.rdv_debut).getTime() > maintenant
      ) {
        resultat.projets.push({ ...base, nature: "rdv_a_confirmer", detail: "Rendez-vous à confirmer", urgence: 2 });
      }
    }
    resultat.projets.sort((a, b) => a.urgence - b.urgence);
  }

  resultat.total = resultat.demandes.length + resultat.suites.length + resultat.avis.length + resultat.projets.length;
  return resultat;
}
