import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { Logo } from "@/components/Logo";
import { ROLE_LABELS, type Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen">
      <header
        className="border-b"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <nav aria-label="Navigation principale" className="flex flex-wrap items-center gap-4 text-sm">
            <span style={{ color: "var(--color-muted)" }}>
              {profile.prenom} {profile.nom} · <strong>{ROLE_LABELS[profile.role]}</strong>
            </span>
            <Link href="/projets" className="font-medium underline">
              Projets
            </Link>
            {(profile.role === "admin" || profile.role === "partenaire") && (
              <Link href="/invitations/new" className="font-medium underline">
                Inviter
              </Link>
            )}
            {profile.role === "admin" && (
              <Link href="/admin" className="font-medium underline">
                Back-office
              </Link>
            )}
            <form action={logout}>
              <button type="submit" className="font-medium underline">
                Déconnexion
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
