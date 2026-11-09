import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import type { DirectMessage, Profile } from "@/lib/types";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .or(`expediteur_id.eq.${user.id},destinataire_id.eq.${user.id}`)
    .order("date_envoi", { ascending: false })
    .returns<DirectMessage[]>();

  const byOther = new Map<string, { last: DirectMessage; unread: number }>();
  for (const m of messages ?? []) {
    const other = m.expediteur_id === user.id ? m.destinataire_id : m.expediteur_id;
    const entry = byOther.get(other);
    const isUnreadForMe = m.destinataire_id === user.id && !m.lu;
    if (!entry) {
      byOther.set(other, { last: m, unread: isUnreadForMe ? 1 : 0 });
    } else if (isUnreadForMe) {
      entry.unread += 1;
    }
  }

  const otherIds = Array.from(byOther.keys());
  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("*").in("id", otherIds).returns<Profile[]>()
    : { data: [] as Profile[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // L'annuaire de l'équipe, pour démarrer une conversation avec quelqu'un à
  // qui l'on n'a encore jamais écrit.
  const { data: equipe } = await supabase
    .from("profiles")
    .select("id, prenom, nom, organisation, photo_url, role")
    .in("role", ["admin", "partenaire"])
    .neq("id", user.id)
    .order("organisation", { ascending: true, nullsFirst: false })
    .order("prenom", { ascending: true })
    .returns<Pick<Profile, "id" | "prenom" | "nom" | "organisation" | "photo_url" | "role">[]>();

  const conversations = Array.from(byOther.entries())
    .map(([otherId, entry]) => ({ otherId, profile: profileById.get(otherId), ...entry }))
    .sort((a, b) => new Date(b.last.date_envoi).getTime() - new Date(a.last.date_envoi).getTime());

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Messages</h1>

      {!conversations.length ? (
        <div className="card p-6 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucune conversation pour le moment. Choisissez ci-dessous un membre de l&apos;équipe pour
          lui écrire directement.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map((c) => (
            <li key={c.otherId}>
              <Link
                href={`/messages/${c.otherId}`}
                className="card card-hover flex items-center gap-3 p-4"
              >
                <Avatar nom={c.profile?.nom} prenom={c.profile?.prenom} photoUrl={c.profile?.photo_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {c.profile ? `${c.profile.prenom} ${c.profile.nom}` : "Utilisateur"}
                    </span>
                    {!!c.unread && (
                      <span
                        className="tag"
                        style={{ "--tag-bg": "var(--color-accent-soft)", "--tag-color": "var(--color-accent)" } as React.CSSProperties}
                      >
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm" style={{ color: "var(--color-muted)" }}>
                    {c.last.contenu}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!!equipe?.length && (
        <details className="card mt-6 p-4" open={!conversations.length}>
          <summary className="cursor-pointer font-semibold">Écrire à un membre de l&apos;équipe</summary>
          <ul className="mt-3 flex flex-col gap-1">
            {equipe.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/messages/${p.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-surface-alt)]"
                  style={{ minHeight: 44 }}
                >
                  <Avatar nom={p.nom} prenom={p.prenom} photoUrl={p.photo_url} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {p.prenom} {p.nom}
                    </span>
                    {p.organisation && (
                      <span className="block truncate text-sm" style={{ color: "var(--color-muted)" }}>
                        {p.organisation}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
                    Écrire
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
