import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { InterregMention } from "@/components/InterregFooter";
import { Logo } from "@/components/Logo";
import { SidebarNav, type NavItem } from "@/components/SidebarNav";
import { BarrePorteur } from "@/components/BarrePorteur";
import { chargerAFaire } from "@/lib/a-faire";
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

  const porteur = profile.role === "porteur";

  const { count: messagesNonLus } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("destinataire_id", user.id)
    .eq("lu", false);

  // Le menu est taillé pour chaque rôle. Un porteur n'a que deux lieux : son
  // projet et sa conversation avec l'équipe. L'équipe arrive sur ce qui attend
  // son action ; les notifications y sont intégrées plutôt que rangées à part,
  // et « Inviter » — un geste, pas un lieu — rejoint l'administration.
  let items: NavItem[];
  if (porteur) {
    items = [
      { href: "/mon-projet", label: "Mon projet", exact: true },
      { href: "/mon-projet/messages", label: "Messages" },
    ];
  } else {
    const aFaire = await chargerAFaire(supabase, user.id, profile.role);
    items = [
      { href: "/", label: "À faire", badge: aFaire.total, badgeFort: true },
      { href: "/demandes", label: "Demandes" },
      { href: "/projets", label: "Projets" },
      { href: "/promotions", label: "Promotions" },
      { href: "/messages", label: "Messages", badge: messagesNonLus ?? 0 },
    ];
    if (profile.role === "admin") items.push({ href: "/admin", label: "Administration" });
  }

  return (
    <div className="md:flex md:min-h-screen">
      {/* Le menu reste à l'écran en permanence : collé en haut sur mobile,
          collé au bord sur grand écran. Pour le porteur, sur téléphone, il
          devient une barre d'onglets en bas de l'écran, là où le pouce va. */}
      <aside
        className={`sticky top-0 z-30 border-b md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r ${porteur ? "max-md:hidden" : ""}`}
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:flex-col md:items-start md:gap-3">
          <Link href={porteur ? "/mon-projet" : "/"} className="flex items-center gap-2">
            <Logo />
          </Link>
        </div>

        <SidebarNav items={items} grand={porteur} />

        <div
          className="flex flex-wrap items-center gap-2 border-t px-4 py-3 md:mt-auto md:flex-col md:items-stretch md:px-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Link
            href="/profil"
            className="flex flex-1 items-center gap-2 rounded-lg px-2 py-2 text-xs transition hover:bg-[var(--color-bg)]"
            style={{ color: "var(--color-muted)" }}
          >
            <Avatar nom={profile.nom} prenom={profile.prenom} photoUrl={profile.photo_url} size="sm" />
            <span>
              <strong style={{ color: "var(--color-text)" }}>Mon compte</strong>
              <br />
              {profile.prenom} {profile.nom}
              {porteur ? "" : ` · ${ROLE_LABELS[profile.role]}`}
            </span>
          </Link>
          <form action={logout} className="md:w-full">
            <button type="submit" className="btn btn-outline w-full">
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {porteur && (
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b px-5 py-3 md:hidden"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <Link href="/mon-projet" aria-label="Mon projet">
            <Logo compact />
          </Link>
          <Link href="/profil" aria-label="Mon compte">
            <Avatar nom={profile.nom} prenom={profile.prenom} photoUrl={profile.photo_url} size="sm" />
          </Link>
        </header>
      )}

      <main
        id="main"
        className={`mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 ${porteur ? "max-md:pb-28 max-md:pt-5" : ""}`}
      >
        <div className="flex-1">{children}</div>
        <InterregMention />
      </main>

      {porteur && <BarrePorteur />}
    </div>
  );
}
