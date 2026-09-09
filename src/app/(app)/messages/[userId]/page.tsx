import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { ROLE_LABELS, type DirectMessage, type Profile } from "@/lib/types";
import { DirectMessageThread } from "./DirectMessageThread";

export default async function ConversationPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (userId === user.id) redirect("/messages");

  const { data: other } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();
  if (!other) notFound();

  // Marque comme lus les messages reçus de cette personne.
  await supabase
    .from("messages")
    .update({ lu: true })
    .eq("destinataire_id", user.id)
    .eq("expediteur_id", userId)
    .eq("lu", false);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(expediteur_id.eq.${user.id},destinataire_id.eq.${userId}),and(expediteur_id.eq.${userId},destinataire_id.eq.${user.id})`
    )
    .order("date_envoi", { ascending: true })
    .returns<DirectMessage[]>();

  return (
    <div>
      <Link href="/messages" className="mb-4 inline-block text-sm underline">
        ← Toutes les conversations
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <Avatar nom={other.nom} prenom={other.prenom} photoUrl={other.photo_url} size="lg" />
        <div>
          <h1 className="text-xl font-semibold">
            {other.prenom} {other.nom}
          </h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {ROLE_LABELS[other.role]}
            {other.organisation ? ` · ${other.organisation}` : ""}
          </p>
        </div>
      </div>
      <DirectMessageThread otherId={userId} meId={user.id} messages={messages ?? []} />
    </div>
  );
}
