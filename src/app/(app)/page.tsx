import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();

  if (!profile) return null;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Bonjour {profile.prenom} 👋</h1>
      <p className="mb-6" style={{ color: "var(--color-muted)" }}>
        Voici le socle ArcInnoLab (comptes, rôles, invitations). Les fiches projet, RDV, étapes et
        messagerie arrivent dans les prochaines briques, une fois ce socle validé.
      </p>

      {profile.role === "admin" && (
        <div className="rounded-lg border p-5" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="mb-2 text-lg font-medium">Administrateur</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Gérez les comptes et les invitations depuis le{" "}
            <a href="/admin" className="font-medium underline">back-office</a>.
          </p>
        </div>
      )}

      {profile.role === "partenaire" && (
        <div className="rounded-lg border p-5" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="mb-2 text-lg font-medium">Partenaire ArcInnoLab</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Vous pouvez <a href="/invitations/new" className="font-medium underline">inviter un porteur de projet</a>.
            La création de fiche projet arrive dans la brique suivante.
          </p>
        </div>
      )}

      {profile.role === "porteur" && (
        <div className="rounded-lg border p-5" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="mb-2 text-lg font-medium">Votre espace porteur de projet</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun projet pour le moment. Votre référent ArcInnoLab créera votre fiche projet
            prochainement.
          </p>
        </div>
      )}
    </div>
  );
}
