import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { heure, jourCourt, lireParcours, type LectureParcours } from "@/lib/parcours";
import { ETAT_LABELS, type ColonneProjet, type EtapeProjet, type Profile, type Projet, type Promotion } from "@/lib/types";
import { FormPromotion } from "../FormPromotion";

export const dynamic = "force-dynamic";

const JOUR = 86_400_000;

function jour(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });
}

type Demande = {
  id: string;
  titre_projet: string;
  prenom: string;
  nom: string;
  organisation: string | null;
  statut: string;
  projet_id: string | null;
  tours_vote: { statut: string; created_at: string; date_limite: string; votants_attendus: number; votes: { position: string }[] }[];
};

type Suivi = {
  projet: Projet;
  porteur: string;
  referent: string | null;
  lecture: LectureParcours;
};

type Candidat = {
  demande: Demande;
  exprimes: number;
  favorables: number;
  attendus: number;
  joursRestants: number | null;
  clos: boolean;
};

/** Calculs dépendant de l'heure, faits au chargement et non au rendu. */
function preparer(
  demandes: Demande[],
  projets: Projet[],
  etapes: EtapeProjet[],
  colonnes: ColonneProjet[],
  noms: Map<string, string>
): { candidats: Candidat[]; suivis: Suivi[] } {
  const instant = Date.now();
  const candidats = demandes
    .filter((d) => d.statut === "en_instruction")
    .map((d) => {
      const t = [...d.tours_vote].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      return {
        demande: d,
        exprimes: t?.votes.length ?? 0,
        favorables: t?.votes.filter((v) => v.position === "favorable").length ?? 0,
        attendus: t?.votants_attendus ?? 0,
        joursRestants: t && t.statut !== "clos" ? Math.ceil((new Date(t.date_limite).getTime() - instant) / JOUR) : null,
        clos: t?.statut === "clos",
      };
    });
  const parId = new Map(demandes.map((d) => [d.projet_id, d]));
  const suivis = projets.map((p) => {
    const d = parId.get(p.id);
    return {
      projet: p,
      porteur: d ? `${d.prenom} ${d.nom}` : "—",
      referent: noms.get(p.id_partenaire_createur) ?? null,
      lecture: lireParcours(
        etapes.filter((e) => e.projet_id === p.id),
        colonnes.filter((c) => c.projet_id === p.id),
        instant
      ),
    };
  });
  return { candidats, suivis };
}

/**
 * Une promotion : sa sélection en cours (projets au vote) et le suivi
 * individuel des projets admis — avancement, retards, prochain rendez-vous.
 */
export default async function PromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  if (profile?.role === "porteur") redirect("/mon-projet");
  const estAdmin = profile?.role === "admin";

  const { data: promotion } = await supabase.from("promotions").select("*").eq("id", id).maybeSingle<Promotion>();
  if (!promotion) notFound();

  const { data: demandes } = await supabase
    .from("demandes_accueil")
    .select("id, titre_projet, prenom, nom, organisation, statut, projet_id, tours_vote(statut, created_at, date_limite, votants_attendus, votes(position))")
    .eq("promotion_id", id)
    .order("created_at", { ascending: true })
    .returns<Demande[]>();

  const idsProjets = (demandes ?? []).filter((d) => d.statut === "admise" && d.projet_id).map((d) => d.projet_id!);
  const vide = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: projets }, { data: etapes }, { data: colonnes }, { data: profils }] = await Promise.all([
    supabase.from("projets").select("*").in("id", idsProjets.length ? idsProjets : vide).returns<Projet[]>(),
    supabase.from("etapes_projet").select("*").in("projet_id", idsProjets.length ? idsProjets : vide).returns<EtapeProjet[]>(),
    supabase.from("colonnes_projet").select("*").in("projet_id", idsProjets.length ? idsProjets : vide).returns<ColonneProjet[]>(),
    supabase.from("profiles").select("id, prenom, nom").in("role", ["admin", "partenaire"]),
  ]);
  const noms = new Map((profils ?? []).map((p) => [p.id as string, `${p.prenom} ${p.nom}`]));

  const { candidats, suivis } = preparer(demandes ?? [], projets ?? [], etapes ?? [], colonnes ?? [], noms);
  const nonRetenues = (demandes ?? []).filter((d) => d.statut === "non_retenue");
  const admis = suivis.length;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/promotions" className="text-sm">
        ← Promotions
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold md:text-3xl">{promotion.nom}</h1>
            <span
              className="pastille"
              style={promotion.ouverte ? { background: "var(--color-success-soft)", color: "var(--color-success)" } : { background: "#e9edf4", color: "#3b4452" }}
            >
              {promotion.ouverte ? "Ouverte aux candidatures" : "Fermée"}
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            {promotion.date_comite ? `Comité le ${jour(promotion.date_comite)}` : "Date du comité à fixer"}
            {promotion.date_debut ? ` · accompagnement du ${jour(promotion.date_debut)}` : ""}
            {promotion.date_fin ? ` au ${jour(promotion.date_fin)}` : ""}
            {` · ${admis} admis${promotion.places ? ` sur ${promotion.places} places` : ""}`}
          </p>
          {promotion.description && <p className="mt-2 max-w-3xl text-sm">{promotion.description}</p>}
        </div>
        {estAdmin && <FormPromotion promotion={promotion} libelle="Modifier" classe="btn btn-outline" />}
      </header>

      <section className="card p-5" aria-labelledby="au-vote">
        <h2 id="au-vote" className="text-lg font-semibold">
          Candidatures au vote <span className="font-normal" style={{ color: "var(--color-muted)" }}>{candidats.length}</span>
        </h2>
        {!candidats.length ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun projet au vote. Un projet y arrive depuis sa qualification (« Mettre au vote »).
          </p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {candidats.map((c) => (
              <li key={c.demande.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t py-3" style={{ borderColor: "#eef1f6" }}>
                <div className="min-w-0 flex-1 basis-64">
                  <Link href={`/demandes/${c.demande.id}`} className="font-semibold" style={{ color: "var(--color-text)" }}>
                    {c.demande.titre_projet}
                  </Link>
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {c.demande.prenom} {c.demande.nom}
                    {c.demande.organisation ? ` · ${c.demande.organisation}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold" style={{ color: "#5b4bb7" }}>
                  {c.exprimes}/{c.attendus} avis · {c.favorables} favorable{c.favorables > 1 ? "s" : ""}
                </span>
                <span className="text-sm" style={{ color: c.clos ? "#7a4a00" : "#3b4452", fontWeight: c.clos ? 700 : 400 }}>
                  {c.clos
                    ? "Décision à prononcer"
                    : c.joursRestants !== null && c.joursRestants <= 0
                      ? "Clôture aujourd'hui"
                      : `Clôture dans ${c.joursRestants} j`}
                </span>
                <Link href={`/demandes/${c.demande.id}${c.clos ? "#decision" : "#consultation"}`} className={c.clos && estAdmin ? "btn btn-primary" : "btn btn-outline"}>
                  {c.clos && estAdmin ? "Décider" : "Voir"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="projets-promo">
        <h2 id="projets-promo" className="text-lg font-semibold">
          Projets de la promotion <span className="font-normal" style={{ color: "var(--color-muted)" }}>{suivis.length}</span>
        </h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Le suivi individuel : où en est chaque projet, ce qui est en retard, le prochain rendez-vous.
        </p>
        {!suivis.length ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun projet admis pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {suivis.map(({ projet: p, porteur, referent, lecture }) => {
              const pct = lecture.total ? Math.round((lecture.validees / lecture.total) * 100) : 0;
              return (
                <li key={p.id}>
                  <Link href={`/projets/${p.id}`} className="card card-hover flex h-full flex-col gap-2 p-4" style={{ color: "var(--color-text)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{p.titre}</p>
                        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                          {porteur}
                          {referent ? ` · accompagné par ${referent}` : ""}
                        </p>
                      </div>
                      <span className="pastille" style={{ background: "#e9edf4", color: "#3b4452" }}>
                        {ETAT_LABELS[p.etat]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "#eef1f6" }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-success)" }} />
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {lecture.total ? `${lecture.validees}/${lecture.total} étapes` : "Parcours à construire"}
                      </span>
                    </div>
                    <p className="flex flex-wrap gap-x-3 text-sm">
                      {lecture.enRetard > 0 && (
                        <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>
                          {lecture.enRetard} en retard
                        </span>
                      )}
                      {lecture.aValider > 0 && <span style={{ fontWeight: 600 }}>{lecture.aValider} à valider</span>}
                      {lecture.prochainRdv?.rdv_debut ? (
                        <span style={{ color: "#7a4a00" }}>
                          Rendez-vous le {jourCourt(lecture.prochainRdv.rdv_debut)} à {heure(lecture.prochainRdv.rdv_debut)}
                        </span>
                      ) : lecture.prochaine ? (
                        <span style={{ color: "var(--color-muted)" }}>Prochaine étape : {lecture.prochaine.titre}</span>
                      ) : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {nonRetenues.length > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer text-base font-semibold">Non retenues ({nonRetenues.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {nonRetenues.map((d) => (
              <li key={d.id}>
                <Link href={`/demandes/${d.id}`}>{d.titre_projet}</Link>{" "}
                <span style={{ color: "var(--color-muted)" }}>
                  · {d.prenom} {d.nom}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
