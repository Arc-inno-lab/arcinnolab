import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DemandeAccueil, Profile, Promotion } from "@/lib/types";
import { NouvellePromotion } from "./NouvellePromotion";
import {
  DEMANDE_STATUT_LABELS,
  DEMANDE_STATUT_COLORS,
  PAYS_LABELS,
  PERSONA_LABELS,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Ancienneté en toutes lettres. L'instant de référence est passé en paramètre
 * plutôt que lu dans la fonction : appeler `Date.now()` pendant le rendu donne
 * un résultat différent à chaque exécution, ce qui rend l'affichage instable.
 */
function depuis(iso: string, maintenant: number) {
  const jours = Math.floor((maintenant - new Date(iso).getTime()) / 86_400_000);
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 31) return `il y a ${jours} jours`;
  const mois = Math.floor(jours / 30);
  return `il y a ${mois} mois`;
}

const SEMAINE_MS = 7 * 86_400_000;

type LigneFile = {
  demande: DemandeAccueil;
  anciennete: string;
  sansReponse: boolean;
};

/**
 * Prépare les lignes de la file. Volontairement hors du composant : lire
 * l'heure courante fait partie du chargement des données, pas du rendu — et
 * React interdit à juste titre les appels impurs pendant celui-ci.
 */
function preparerLignes(demandes: DemandeAccueil[]): LigneFile[] {
  const maintenant = Date.now();
  return demandes.map((d) => ({
    demande: d,
    anciennete: depuis(d.created_at, maintenant),
    sansReponse:
      d.statut === "nouvelle" && maintenant - new Date(d.created_at).getTime() > SEMAINE_MS,
  }));
}

/**
 * La file d'accueil.
 *
 * Elle est ordonnée par ancienneté et non par date d'arrivée décroissante : ce
 * qui compte ici n'est pas la nouveauté mais le temps d'attente. Une demande
 * laissée sans réponse est le seul vrai échec de ce guichet.
 */
export default async function DemandesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre = "a_traiter" } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  // Les porteurs n'ont rien à faire dans la file d'accueil de l'équipe.
  if (profile?.role === "porteur") redirect("/");

  let requete = supabase
    .from("demandes_accueil")
    .select("*, coach:profiles!demandes_accueil_coach_id_fkey(nom, prenom, photo_url)");

  if (filtre === "a_traiter") {
    requete = requete.in("statut", ["nouvelle", "en_accueil"]);
  } else if (filtre === "comite") {
    requete = requete.eq("statut", "en_attente_comite");
  } else if (filtre === "orientees") {
    requete = requete.eq("statut", "orientee");
  }

  const { data: demandes } = await requete
    .order("created_at", { ascending: true })
    .returns<DemandeAccueil[]>();

  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .eq("ouverte", true)
    .order("date_comite", { ascending: true })
    .returns<Promotion[]>();

  const prochaineComite = promotions?.find((p) => p.date_comite);

  const lignes = preparerLignes(demandes ?? []);

  const onglets = [
    { cle: "a_traiter", label: "À traiter" },
    { cle: "comite", label: "En attente du comité" },
    { cle: "orientees", label: "Orientées" },
    { cle: "tout", label: "Toutes" },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Accueil des porteurs</h1>
      <p className="mb-5 text-sm" style={{ color: "var(--color-muted)" }}>
        Les demandes déposées depuis la page publique. Les plus anciennes
        d&apos;abord : c&apos;est le temps d&apos;attente qui compte, pas la
        nouveauté.
      </p>

      {prochaineComite && (
        <div className="card mb-5 p-4">
          <p className="text-sm">
            <strong>Prochain comité</strong> — {prochaineComite.nom}, le{" "}
            {new Date(prochaineComite.date_comite!).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            .
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            Le comité ne siège qu&apos;une fois par an. Pour toute demande qui
            n&apos;a pas besoin d&apos;attendre cette date, l&apos;orientation
            est la bonne réponse.
          </p>
        </div>
      )}

      {profile?.role === "admin" && <NouvellePromotion />}

      <div className="mb-5 flex flex-wrap gap-2">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={`/demandes?filtre=${o.cle}`}
            aria-current={filtre === o.cle ? "page" : undefined}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={
              filtre === o.cle
                ? { background: "var(--color-primary)", color: "#fff" }
                : { background: "var(--color-surface-alt)", color: "var(--color-text)" }
            }
          >
            {o.label}
          </Link>
        ))}
      </div>

      {!lignes.length ? (
        <div className="card p-5 text-sm" style={{ color: "var(--color-muted)" }}>
          {filtre === "a_traiter"
            ? "Aucune demande en attente. La file est vide."
            : "Aucune demande dans cette vue."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {lignes.map(({ demande: d, anciennete, sansReponse }) => {
            return (
              <li key={d.id}>
                <Link href={`/demandes/${d.id}`} className="card card-hover block p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{d.titre_projet}</p>
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                        {d.prenom} {d.nom}
                        {d.organisation ? ` · ${d.organisation}` : ""} ·{" "}
                        {PAYS_LABELS[d.pays]}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: DEMANDE_STATUT_COLORS[d.statut], color: "#fff" }}
                    >
                      {DEMANDE_STATUT_LABELS[d.statut]}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm">{d.description}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--color-muted)" }}>
                    <span>Déposée {anciennete}</span>
                    {d.persona && <span>{PERSONA_LABELS[d.persona]}</span>}
                    <span>
                      {d.coach
                        ? `Suivie par ${d.coach.prenom} ${d.coach.nom}`
                        : "Personne ne l'a encore prise en charge"}
                    </span>
                    {sansReponse && (
                      <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>
                        Sans réponse depuis plus d&apos;une semaine
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
