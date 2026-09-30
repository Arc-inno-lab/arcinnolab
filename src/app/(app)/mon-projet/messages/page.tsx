import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chargerMonProjet } from "@/lib/mon-projet";
import { aujourdhuiIso } from "@/lib/parcours";
import type { Profile } from "@/lib/types";
import { ChatProjet } from "@/components/ChatProjet";

export const dynamic = "force-dynamic";

function maintenant() {
  return Date.now();
}

/**
 * La messagerie du porteur : une seule conversation, avec l'équipe de son
 * projet — son accompagnateur et les partenaires rattachés, personne d'autre.
 * « J'ai besoin d'aide » arrive ici avec une phrase déjà commencée.
 */
export default async function MessagesPorteurPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; aide?: string }>;
}) {
  const { p, aide } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  if (!profile) redirect("/login");
  if (profile.role !== "porteur") redirect("/messages");

  const donnees = await chargerMonProjet(supabase, profile.id, p);
  if (!donnees) redirect("/mon-projet");

  const { projet, accompagnateur, partenaires, messages, documents, etapes } = donnees;
  const equipe = [...(accompagnateur ? [accompagnateur] : []), ...partenaires];
  const noms = equipe.map((x) => `${x.prenom} ${x.nom}`);
  const etapeAide = aide ? etapes.find((e) => e.id === aide) : undefined;
  const texteInitial = etapeAide ? `J'ai besoin d'aide pour « ${etapeAide.titre} » : ` : "";

  return (
    <div className="mx-auto flex h-[calc(100dvh-12.5rem)] max-w-3xl flex-col md:h-[calc(100dvh-4rem)]">
      <header className="mb-3 flex items-center gap-2">
        <Link
          href={`/mon-projet?p=${projet.id}`}
          aria-label="Retour à mon projet"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ color: "var(--color-text)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold leading-tight">L&apos;équipe de votre projet</h1>
          <p className="truncate text-[15px]" style={{ color: "var(--color-muted)" }}>
            {noms.length === 0 ? projet.titre : noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`}
          </p>
        </div>
      </header>

      <section className="card flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
        <ChatProjet
          projetId={projet.id}
          messages={messages}
          documents={documents}
          moi={profile.id}
          aujourdhui={aujourdhuiIso(maintenant())}
          texteInitial={texteInitial}
        />
      </section>
    </div>
  );
}
