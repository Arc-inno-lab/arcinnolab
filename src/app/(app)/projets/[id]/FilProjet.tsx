"use client";

import { useEffect, useRef, useTransition } from "react";
import { createMessageProjet } from "@/app/actions";
import { ROLE_LABELS, type MessageProjet } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

/**
 * Le fil du projet, tenu en colonne à droite plutôt qu'en bas de page.
 *
 * Placé sous le kanban, il fallait faire défiler tout l'écran pour le voir, et
 * l'on perdait de vue ce dont on parlait. En colonne, la conversation reste à
 * côté du travail : les messages les plus récents en bas, la zone d'écriture
 * toujours accessible, comme dans n'importe quelle messagerie.
 */
export function FilProjet({
  projetId,
  messages,
}: {
  projetId: string;
  messages: MessageProjet[];
}) {
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const filRef = useRef<HTMLDivElement>(null);

  // Ouvrir sur le dernier message, pas sur le premier : c'est celui qu'on
  // vient lire.
  useEffect(() => {
    const fil = filRef.current;
    if (fil) fil.scrollTop = fil.scrollHeight;
  }, [messages.length]);

  function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const contenu = textareaRef.current?.value ?? "";
    if (!contenu.trim()) return;
    startTransition(() => createMessageProjet(projetId, contenu));
    if (textareaRef.current) textareaRef.current.value = "";
  }

  return (
    <section
      aria-labelledby="fil-heading"
      className="card flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]"
    >
      <header
        className="border-b px-4 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h2 id="fil-heading" className="text-base font-medium">
          Fil du projet
        </h2>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          {messages.length
            ? `${messages.length} message${messages.length > 1 ? "s" : ""} · visible par toute l'équipe du projet`
            : "Visible par toute l'équipe du projet"}
        </p>
      </header>

      <div
        ref={filRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ minHeight: "12rem" }}
      >
        {!messages.length ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Rien n&apos;a encore été dit. Une nouvelle, une question, une date :
            tout ce qui concerne le projet a sa place ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-2">
                <Avatar
                  nom={m.auteur?.nom}
                  prenom={m.auteur?.prenom}
                  photoUrl={m.auteur?.photo_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    <span className="font-medium" style={{ color: "var(--color-text)" }}>
                      {m.auteur ? `${m.auteur.prenom} ${m.auteur.nom}` : "Un membre"}
                    </span>
                    {m.auteur?.role && ` · ${ROLE_LABELS[m.auteur.role]}`}
                    {" · "}
                    {new Date(m.created_at).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p
                    className="mt-1 whitespace-pre-wrap rounded-md px-3 py-2 text-sm"
                    style={{ background: "var(--color-surface-alt)" }}
                  >
                    {m.contenu}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={envoyer}
        className="border-t px-4 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <label htmlFor="nouveau-message" className="sr-only">
          Nouveau message
        </label>
        <textarea
          id="nouveau-message"
          ref={textareaRef}
          placeholder="Écrire à l'équipe du projet…"
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
        />
        <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full">
          {pending ? "Envoi…" : "Publier"}
        </button>
      </form>
    </section>
  );
}
