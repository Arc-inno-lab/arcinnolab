"use client";

import { useEffect, useRef, useState } from "react";
import { envoyerNoteInterne } from "@/app/actions-qualification";
import { Avatar } from "@/components/Avatar";
import { useEnvoi } from "@/lib/useEnvoi";
import type { NoteDemande } from "@/lib/types";

export type Equipier = { id: string; prenom: string; nom: string };

/**
 * La discussion de l'équipe sur une demande. Le porteur ne la voit jamais :
 * c'est l'endroit pour dire « je ne suis pas sûr que ce soit pour nous » ou
 * « @Marie, c'est ton domaine, tu peux l'appeler ? ».
 *
 * Mentionner quelqu'un le prévient dans l'application. Les puces évitent de
 * taper un @ et de chercher la bonne orthographe d'un nom.
 */
export function FilInterne({
  demandeId,
  notes,
  equipe,
  moi,
}: {
  demandeId: string;
  /** Chaque message arrive avec sa date déjà formatée par le serveur. */
  notes: (NoteDemande & { quand: string })[];
  equipe: Equipier[];
  moi: string;
}) {
  const [mentions, setMentions] = useState<string[]>([]);
  const filRef = useRef<HTMLDivElement>(null);
  const envoi = useEnvoi(envoyerNoteInterne, { onSucces: () => setMentions([]) });
  const noms = new Map(equipe.map((e) => [e.id, e.prenom]));
  const autres = equipe.filter((e) => e.id !== moi);

  useEffect(() => {
    const fil = filRef.current;
    if (fil) fil.scrollTop = fil.scrollHeight;
  }, [notes.length]);

  function basculer(id: string) {
    setMentions((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  return (
    <section id="discussion" className="card flex scroll-mt-6 flex-col overflow-hidden" style={{ borderTop: "4px solid #5b4bb7" }}>
      <header className="border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold">Discussion de l&apos;équipe</h2>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Entre partenaires. Le porteur ne voit pas ces messages.
        </p>
      </header>

      <div ref={filRef} className="max-h-[22rem] overflow-y-auto px-4 py-3">
        {!notes.length ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Pas encore d&apos;échange. Mentionnez un partenaire pour lui demander son avis.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.id} className="flex gap-2">
                <Avatar nom={n.auteur?.nom} prenom={n.auteur?.prenom} photoUrl={n.auteur?.photo_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                      {n.auteur_id === moi ? "Vous" : (n.auteur?.prenom ?? "Un partenaire")}
                    </span>{" "}
                    · {n.quand}
                  </p>
                  {n.mentions.length > 0 && (
                    <p className="mt-0.5 text-xs font-semibold" style={{ color: "#5b4bb7" }}>
                      {n.mentions.map((id) => `@${id === moi ? "vous" : (noms.get(id) ?? "?")}`).join(" ")}
                    </p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap rounded-md px-3 py-2 text-sm" style={{ background: "#f3f1fb" }}>
                    {n.contenu}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={envoi.onSubmit} className="border-t px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
        <input type="hidden" name="demande_id" value={demandeId} />
        {mentions.map((id) => (
          <input key={id} type="hidden" name="mentions" value={id} />
        ))}
        {autres.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              Mentionner :
            </span>
            {autres.map((e) => {
              const actif = mentions.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => basculer(e.id)}
                  aria-pressed={actif}
                  className="rounded-full border px-2.5 text-xs"
                  style={{
                    minHeight: 30,
                    borderColor: actif ? "#5b4bb7" : "var(--color-border)",
                    background: actif ? "#ece9fa" : "var(--color-surface)",
                    color: actif ? "#5b4bb7" : "var(--color-text)",
                    fontWeight: actif ? 700 : 500,
                  }}
                >
                  @{e.prenom} {e.nom.charAt(0)}.
                </button>
              );
            })}
          </div>
        )}
        <label htmlFor="note-interne" className="sr-only">
          Message à l&apos;équipe
        </label>
        <textarea
          id="note-interne"
          name="contenu"
          rows={2}
          required
          placeholder="Écrire à l'équipe…"
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
        />
        {envoi.erreur && (
          <p role="alert" className="mt-1 text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
            {envoi.erreur}
          </p>
        )}
        <button type="submit" disabled={envoi.pending} className="btn mt-2 w-full" style={{ background: "#5b4bb7", color: "#fff" }}>
          {envoi.pending ? "Envoi…" : mentions.length ? `Envoyer et prévenir (${mentions.length})` : "Envoyer"}
        </button>
      </form>
    </section>
  );
}
