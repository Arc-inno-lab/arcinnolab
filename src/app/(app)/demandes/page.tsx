import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/config";
import type { DemandeAccueil, Profile } from "@/lib/types";
import { TableauDemandes, type CarteDemande } from "./TableauDemandes";
import { LienDepot } from "./LienDepot";

export const dynamic = "force-dynamic";

const JOUR = 86_400_000;

function depuis(iso: string, maintenant: number) {
  const jours = Math.floor((maintenant - new Date(iso).getTime()) / JOUR);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 31) return `il y a ${jours} j`;
  return `il y a ${Math.floor(jours / 30)} mois`;
}

type Tour = { id: string; demande_id: string; statut: string; votants_attendus: number; votes: { votant_id: string }[] };

/** Prépare les cartes hors rendu : l'instant courant fait partie du chargement. */
function preparer(demandes: DemandeAccueil[], tours: Tour[], moi: string): CarteDemande[] {
  const maintenant = Date.now();
  const tourDe = new Map<string, Tour>();
  for (const t of tours) if (!tourDe.has(t.demande_id)) tourDe.set(t.demande_id, t);
  return demandes.map((d) => {
    const t = tourDe.get(d.id);
    const jours = Math.floor((maintenant - new Date(d.created_at).getTime()) / JOUR);
    return {
      id: d.id,
      statut: d.statut,
      titre: d.titre_projet,
      porteur: `${d.prenom} ${d.nom}`,
      organisation: d.organisation,
      pays: d.pays,
      anciennete: depuis(d.created_at, maintenant),
      sansReponse: d.statut === "nouvelle" && jours >= 7 ? jours : null,
      coach: d.coach ? d.coach.prenom : null,
      coachId: d.coach_id,
      adn: d.adn_arcinnolab,
      vote: t && (t.statut === "en_cours" || t.statut === "complet")
        ? { exprimes: t.votes.length, attendus: t.votants_attendus, monAvisAttendu: t.statut === "en_cours" && !t.votes.some((v) => v.votant_id === moi) }
        : null,
      voteClos: !!t && t.statut === "clos",
      misAJour: d.updated_at,
    };
  });
}

/**
 * Le tableau des demandes : d'un coup d'œil, où en est chaque porteur entre
 * son dépôt et la décision. On fait avancer une carte en la glissant tant que
 * rien ne se décide ; les décisions (refus, orientation, vote, admission) se
 * prennent sur la fiche, avec un motif.
 */
export default async function DemandesPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue = "toutes" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  if (profile?.role === "porteur") redirect("/mon-projet");

  const [{ data: demandes }, { data: tours }] = await Promise.all([
    supabase
      .from("demandes_accueil")
      .select("*, coach:profiles!demandes_accueil_coach_id_fkey(nom, prenom, photo_url)")
      .order("created_at", { ascending: true })
      .returns<DemandeAccueil[]>(),
    supabase
      .from("tours_vote")
      .select("id, demande_id, statut, votants_attendus, votes(votant_id)")
      .order("created_at", { ascending: false })
      .returns<Tour[]>(),
  ]);

  const toutes = preparer(demandes ?? [], tours ?? [], user!.id);
  const avisAttendus = toutes.filter((c) => c.vote?.monAvisAttendu).length;
  const cartes =
    vue === "miennes" ? toutes.filter((c) => c.coachId === user!.id) : vue === "avis" ? toutes.filter((c) => c.vote?.monAvisAttendu) : toutes;

  const vues = [
    { cle: "toutes", label: "Toutes" },
    { cle: "miennes", label: "Que je suis" },
    { cle: "avis", label: avisAttendus ? `Mon avis attendu · ${avisAttendus}` : "Mon avis attendu" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Demandes</h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Du dépôt à la décision. Glissez une carte pour la faire avancer ; on décide de la suite depuis sa fiche.
          </p>
        </div>
        <LienDepot lien={`${APP_URL}/demande`} />
      </header>

      <nav aria-label="Filtrer les demandes" className="flex flex-wrap gap-2">
        {vues.map((v) => (
          <Link
            key={v.cle}
            href={`/demandes?vue=${v.cle}`}
            aria-current={vue === v.cle ? "page" : undefined}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={
              vue === v.cle
                ? { background: "var(--color-primary)", color: "#fff" }
                : {
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: v.cle === "avis" && avisAttendus ? "var(--color-primary)" : "var(--color-text)",
                  }
            }
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <TableauDemandes cartes={cartes} />
    </div>
  );
}
