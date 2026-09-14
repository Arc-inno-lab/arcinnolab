import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { InterregMention } from "@/components/InterregFooter";
import { Logo } from "@/components/Logo";
import { SidebarNav, type NavItem } from "@/components/SidebarNav";
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

  const equipe = profile.role === "admin" || profile.role === "partenaire";

  const [{ count: unreadCount }, { count: unreadDm }, { count: demandesEnAttente }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("lu", false),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("destinataire_id", user.id)
        .eq("lu", false),
      // Seules les demandes que personne n'a encore prises en charge font
      // l'objet d'un badge : c'est l'absence de réponse qui doit alerter, pas
      // le volume de travail en cours.
      equipe
        ? supabase
            .from("demandes_accueil")
            .select("id", { count: "exact", head: true })
            .eq("statut", "nouvelle")
        : Promise.resolve({ count: 0 }),
    ]);

  const items: NavItem[] = [
    { href: "/", label: "Accueil" },
    { href: "/projets", label: "Projets" },
    { href: "/messages", label: "Messages", badge: unreadDm ?? 0 },
    { href: "/notifications", label: "Notifications", badge: unreadCount ?? 0 },
  ];
  if (equipe) {
    // Placée juste après Accueil : la file des porteurs qui attendent une
    // réponse passe avant le suivi des projets déjà accompagnés.
    items.splice(1, 0, {
      href: "/demandes",
      label: "Demandes",
      badge: demandesEnAttente ?? 0,
    });
    items.push({ href: "/invitations/new", label: "Inviter" });
  }
  if (profile.role === "admin") {
    items.push({ href: "/admin", label: "Back-office" });
  }

  return (
    <div className="md:flex md:min-h-screen">
      <aside
        className="border-b md:flex md:min-h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:flex-col md:items-start md:gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            href="/profil"
            className="flex items-center gap-2 rounded-lg px-1 py-1 text-xs transition hover:bg-[var(--color-bg)] md:w-full"
            style={{ color: "var(--color-muted)" }}
          >
            <Avatar nom={profile.nom} prenom={profile.prenom} photoUrl={profile.photo_url} size="sm" />
            <span>
              {profile.prenom} {profile.nom}
              <br />
              <strong style={{ color: "var(--color-text)" }}>{ROLE_LABELS[profile.role]}</strong>
            </span>
          </Link>
        </div>

        <SidebarNav items={items} />

        <div className="px-4 py-3 md:mt-auto md:px-3">
          <form action={logout}>
            <button type="submit" className="btn btn-outline w-full md:w-auto">
              Déconnexion
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
        <div className="flex-1">{children}</div>
        <InterregMention />
      </main>
    </div>
  );
}
