import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Projet } from "@/lib/types";
import { ETAT_LABELS } from "@/lib/types";

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
        <div
          className="rounded-lg border p-5 text-sm"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-muted)" }}
        >
          {profile?.role === "porteur"
            ? "Vous n'êtes rattaché à aucun projet pour le moment."
            : "Aucun projet créé pour le moment."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {projets.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projets/${p.id}`}
                className="block rounded-lg border p-4 transition hover:shadow-sm"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{p.titre}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}
                  >
                    {ETAT_LABELS[p.etat]}
                  </span>
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--color-muted)" }}>
                    {p.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
