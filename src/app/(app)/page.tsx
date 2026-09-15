import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { ROLE_LABELS, type AppNotification, type Profile } from "@/lib/types";

const PARTNER_LOGOS = [
  { src: "/brand/partenaires/km0.png", alt: "KMØ" },
  { src: "/brand/partenaires/he-arc.png", alt: "HE-Arc" },
  { src: "/brand/partenaires/utbm.png", alt: "UTBM" },
  { src: "/brand/partenaires/garesud.png", alt: "Gare Sud" },
  { src: "/brand/partenaires/technhom.png", alt: "Techn'hom" },
  { src: "/brand/partenaires/ville-delemont.png", alt: "Ville de Delémont" },
  { src: "/brand/partenaires/basel-area.svg", alt: "Basel Area" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (!profile) return null;

  const equipe = profile.role === "admin" || profile.role === "partenaire";

  const [
    { count: nbProjets },
    { count: nbEtapesEnCours },
    { count: nbPartenaires },
    { count: nbPorteurs },
    { data: notifications },
    { data: partenaires },
  ] = await Promise.all([
    supabase.from("projets").select("id", { count: "exact", head: true }),
    supabase.from("etapes_projet").select("id", { count: "exact", head: true }).eq("statut", "en_cours"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "partenaire"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "porteur"),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<AppNotification[]>(),
    supabase
      .from("profiles")
      .select("*")
      .in("role", ["admin", "partenaire"])
      .neq("id", user!.id)
      .order("nom", { ascending: true })
      .returns<Profile[]>(),
  ]);

  return (
    <div>
      <div className="hero mb-8 fade-up">
        <div className="hero-bg" style={{ backgroundImage: "url(/brand/hero.jpg)" }} aria-hidden="true" />
        <div className="hero-content">
          <p className="mb-1 text-sm font-medium opacity-90">Bonjour {profile.prenom} 👋</p>
          <h1 className="mb-2 text-3xl font-bold">ArcInnoLab — l&apos;outil collaboratif</h1>
          <p className="max-w-2xl text-sm opacity-90">
            Projets, passeports d&apos;étapes, échanges et fichiers au même endroit. Tout ce qui
            avance sur l&apos;InterLab de l&apos;innovation, visible par toute l&apos;équipe.
          </p>
        </div>
      </div>

      {/* Les compteurs de population ne sont montrés qu'à l'équipe : depuis la
          migration 016, un porteur ne voit que les personnes rattachées à ses
          projets, et afficher « 1 partenaire » lui donnerait une image fausse
          du consortium. */}
      <div className="kpi-grid mb-8">
        <div className="kpi-card fade-up">
          <div className="kpi-value">{nbProjets ?? 0}</div>
          <div className="kpi-label">Projets</div>
        </div>
        <div className="kpi-card fade-up">
          <div className="kpi-value">{nbEtapesEnCours ?? 0}</div>
          <div className="kpi-label">Étapes en cours</div>
        </div>
        {equipe && (
          <>
            <div className="kpi-card fade-up">
              <div className="kpi-value">{nbPartenaires ?? 0}</div>
              <div className="kpi-label">Partenaires ArcInnoLab</div>
            </div>
            <div className="kpi-card fade-up">
              <div className="kpi-value">{nbPorteurs ?? 0}</div>
              <div className="kpi-label">Porteurs de projet</div>
            </div>
          </>
        )}
      </div>

      <div className="mb-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="partenaires-heading">
          <h2 id="partenaires-heading" className="mb-3 text-lg font-medium">
            {equipe ? "L'équipe ArcInnoLab" : "Vos interlocuteurs"}
          </h2>
          {!partenaires?.length ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              {equipe
                ? "Personne d'autre pour le moment."
                : "Aucun interlocuteur rattaché à vos projets pour l'instant. Votre référent apparaîtra ici."}
            </p>
          ) : (
            <div className="partner-directory">
              {partenaires.map((p) => (
                <div key={p.id} className="card card-hover flex items-center gap-3 p-3">
                  <Avatar nom={p.nom} prenom={p.prenom} photoUrl={p.photo_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {p.prenom} {p.nom}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--color-muted)" }}>
                      {ROLE_LABELS[p.role]}
                      {p.organisation ? ` · ${p.organisation}` : ""}
                    </p>
                  </div>
                  <Link href={`/messages/${p.id}`} className="btn btn-outline shrink-0" style={{ minHeight: "36px", padding: "0.375rem 0.75rem" }}>
                    Contacter
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="activite-heading">
          <h2 id="activite-heading" className="mb-3 text-lg font-medium">
            Activité récente
          </h2>
          <div className="card p-2">
            {!notifications?.length ? (
              <p className="p-3 text-sm" style={{ color: "var(--color-muted)" }}>
                Rien pour le moment.
              </p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id} className="border-b p-3 text-sm last:border-0" style={{ borderColor: "var(--color-border)" }}>
                    {n.lien ? (
                      <Link href={n.lien} className="hover:underline">
                        {n.titre}
                      </Link>
                    ) : (
                      n.titre
                    )}
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {new Date(n.created_at).toLocaleString("fr-FR")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/projets" className="card card-hover p-5">
          <h2 className="mb-1 text-base font-semibold">Projets</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Voir tous les projets et leur passeport d&apos;étapes.
          </p>
        </Link>
        {(profile.role === "admin" || profile.role === "partenaire") && (
          <Link href="/projets/nouveau" className="card card-hover p-5">
            <h2 className="mb-1 text-base font-semibold">Nouveau projet</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Créez une fiche projet et invitez un porteur.
            </p>
          </Link>
        )}
        {profile.role === "admin" && (
          <Link href="/admin" className="card card-hover p-5">
            <h2 className="mb-1 text-base font-semibold">Back-office</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Comptes et invitations.
            </p>
          </Link>
        )}
      </div>

      <div className="partner-strip mt-10 border-t" style={{ borderColor: "var(--color-border)" }}>
        {PARTNER_LOGOS.map((l) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={l.alt} src={l.src} alt={l.alt} />
        ))}
      </div>
    </div>
  );
}
