import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Projet } from "@/lib/types";
import { ETAT_LABELS, ETAT_COLORS } from "@/lib/types";

export default async function ProjetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  const { data: projets } = await supabase
    .from("projets")
    .select("*")
    .order("date_creation", { ascending: false })
    .returns<Projet[]>();

  const canCreate = profile?.role === "admin" || profile?.role === "partenaire";

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-3 text-2xl font-semibold">Projets</h1>
        {canCreate && (
          <Link href="/projets/nouveau" className="btn btn-primary">
            + Nouveau projet
          </Link>
        )}
      </div>

      {!projets?.length ? (
        <div className="card p-5 text-sm" style={{ color: "var(--color-muted)" }}>
          {profile?.role === "porteur"
            ? "Vous n'êtes rattaché à aucun projet pour le moment."
            : "Aucun projet créé pour le moment."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projets.map((p) => (
            <li key={p.id}>
              <Link href={`/projets/${p.id}`} className="card card-hover flex items-start gap-3 p-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: "var(--color-surface-alt)" }}
                  aria-hidden="true"
                >
                  {p.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold" style={{ color: "var(--color-muted)" }}>
                      {p.titre.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{p.titre}</span>
                    <span
                      className="tag"
                      style={{ "--tag-color": ETAT_COLORS[p.etat], "--tag-bg": "var(--color-surface-alt)" } as React.CSSProperties}
                    >
                      {ETAT_LABELS[p.etat]}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--color-muted)" }}>
                      {p.description}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
