import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lireParcours, type LectureParcours } from "@/lib/parcours";
import type { ColonneProjet, EtapeProjet, Profile, Projet } from "@/lib/types";
import { ETAT_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

type Carte = {
  projet: Projet;
  referent: string | null;
  porteur: string | null;
  invitationEnAttente: boolean;
  lecture: LectureParcours;
  estReferent: boolean;
};

/**
 * Prépare les cartes. Hors du composant : l'instant courant sert au calcul des
 * retards, il fait partie du chargement, pas du rendu.
 */
function preparer(
  projets: Projet[],
  etapes: EtapeProjet[],
  colonnes: ColonneProjet[],
  noms: Map<string, string>,
  porteurs: Map<string, string>,
  invitations: Set<string>,
  rattachements: Set<string>,
  moi: string
): Carte[] {
  const instant = Date.now();
  return projets.map((p) => ({
    projet: p,
    referent: noms.get(p.id_partenaire_createur) ?? null,
    porteur: porteurs.get(p.id) ?? null,
    invitationEnAttente: invitations.has(p.id),
    lecture: lireParcours(
      etapes.filter((e) => e.projet_id === p.id),
      colonnes.filter((c) => c.projet_id === p.id),
      instant
    ),
    estReferent: p.id_partenaire_createur === moi || rattachements.has(p.id),
  }));
}

/**
 * La liste des projets accompagnés. Plus de bouton « Nouveau projet » : un
 * projet naît de l'admission d'une candidature, et ce raccourci permettait de
 * contourner tout le parcours (demande, consultation, décision).
 */
export default async function ProjetsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre = "tous" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (profile?.role === "porteur") redirect("/mon-projet");

  const [{ data: projets }, { data: etapes }, { data: colonnes }, { data: profils }, { data: membres }, { data: invitations }, { data: liens }] =
    await Promise.all([
      supabase.from("projets").select("*").order("date_creation", { ascending: false }).returns<Projet[]>(),
      supabase.from("etapes_projet").select("*").returns<EtapeProjet[]>(),
      supabase.from("colonnes_projet").select("*").returns<ColonneProjet[]>(),
      supabase.from("profiles").select("id, prenom, nom"),
      supabase.from("membres_projet").select("projet_id, profile:profiles(prenom, nom)"),
      supabase.from("invitations").select("projet_id").eq("statut", "en_attente").not("projet_id", "is", null),
      supabase.from("projet_partenaire").select("projet_id").eq("partenaire_id", user!.id),
    ]);

  const noms = new Map((profils ?? []).map((p) => [p.id as string, `${p.prenom} ${p.nom}`]));
  const porteurs = new Map<string, string>();
  for (const m of membres ?? []) {
    const p = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as { prenom: string; nom: string } | null;
    if (p && !porteurs.has(m.projet_id as string)) porteurs.set(m.projet_id as string, `${p.prenom} ${p.nom}`);
  }

  const toutes = preparer(
    projets ?? [],
    etapes ?? [],
    colonnes ?? [],
    noms,
    porteurs,
    new Set((invitations ?? []).map((i) => i.projet_id as string)),
    new Set((liens ?? []).map((l) => l.projet_id as string)),
    user!.id
  );

  const miennes = toutes.filter((c) => c.estReferent);
  const enRetard = toutes.filter((c) => c.lecture.enRetard > 0);
  const cartes = filtre === "miens" ? miennes : filtre === "retard" ? enRetard : toutes;

  const filtres = [
    { cle: "tous", label: `Tous · ${toutes.length}` },
    { cle: "miens", label: `Dont je suis référent · ${miennes.length}` },
    { cle: "retard", label: `Avec un retard · ${enRetard.length}` },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Projets accompagnés</h1>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Un projet s&apos;ouvre tout seul quand une candidature est admise.
        </p>
      </header>

      <nav aria-label="Filtrer les projets" className="flex flex-wrap gap-2">
        {filtres.map((f) => (
          <Link
            key={f.cle}
            href={`/projets?filtre=${f.cle}`}
            aria-current={filtre === f.cle ? "page" : undefined}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={
              filtre === f.cle
                ? { background: "var(--color-primary)", color: "#fff" }
                : { background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {!cartes.length ? (
        <div className="card p-5 text-sm" style={{ color: "var(--color-muted)" }}>
          {filtre === "tous"
            ? "Aucun projet pour l'instant. Le premier s'ouvrira à la première candidature admise."
            : "Aucun projet dans cette vue."}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cartes.map(({ projet: p, referent, porteur, invitationEnAttente, lecture }) => {
            const pct = lecture.total ? Math.round((lecture.validees / lecture.total) * 100) : 0;
            return (
              <li key={p.id}>
                <Link href={`/projets/${p.id}`} className="card card-hover flex h-full flex-col gap-3 p-5" style={{ color: "var(--color-text)" }}>
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-bold"
                      style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
                      aria-hidden="true"
                    >
                      {p.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        p.titre.charAt(0).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.titre}</p>
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                        {porteur ? `Porteur : ${porteur}` : invitationEnAttente ? "Porteur : invitation envoyée" : "Aucun porteur"}
                        {referent ? ` · Référent : ${referent}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "#e9edf4", color: "#3b4452" }}>
                      {ETAT_LABELS[p.etat]}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">
                        {lecture.total ? `${lecture.validees} étape${lecture.validees > 1 ? "s" : ""} validée${lecture.validees > 1 ? "s" : ""} sur ${lecture.total}` : "Parcours à construire"}
                      </span>
                      {lecture.aValider > 0 && (
                        <span style={{ color: "#3b4452" }}>{lecture.aValider} à valider</span>
                      )}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "#eef1f6" }}>
                      <div className="h-full" style={{ width: `${pct}%`, background: "var(--color-success)" }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {lecture.enRetard > 0 && (
                      <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>
                        {lecture.enRetard === 1 ? "1 étape en retard" : `${lecture.enRetard} étapes en retard`}
                      </span>
                    )}
                    {lecture.prochainRdv && (
                      <span style={{ color: "#7a4a00" }}>
                        Rendez-vous le{" "}
                        {new Date(lecture.prochainRdv.rdv_debut!).toLocaleDateString("fr-FR", {
                          timeZone: "Europe/Paris",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    )}
                    {!lecture.enRetard && !lecture.prochainRdv && lecture.prochaine && (
                      <span style={{ color: "var(--color-muted)" }}>Prochaine étape : {lecture.prochaine.titre}</span>
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
