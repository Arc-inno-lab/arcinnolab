"use client";

import { useRef, useTransition } from "react";
import { createMessageProjet } from "@/app/actions";
import { ROLE_LABELS, type MessageProjet } from "@/lib/types";

export function MessagesProjetSection({
  projetId,
  messages,
}: {
  projetId: string;
  messages: MessageProjet[];
}) {
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const contenu = textareaRef.current?.value ?? "";
    if (!contenu.trim()) return;
    startTransition(() => createMessageProjet(projetId, contenu));
    if (textareaRef.current) textareaRef.current.value = "";
  }

  return (
    <section aria-labelledby="messages-heading" className="mb-6">
      <h2 id="messages-heading" className="mb-3 text-lg font-medium">
        Échanges du projet ({messages.length})
      </h2>

      {!messages.length ? (
        <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucun message pour le moment. Lancez la discussion avec l&apos;équipe du projet.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border p-3 text-sm"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div
                className="mb-1 flex flex-wrap items-center gap-2 text-xs"
                style={{ color: "var(--color-muted)" }}
              >
                <span className="font-medium" style={{ color: "var(--color-text)" }}>
                  {m.auteur ? `${m.auteur.prenom} ${m.auteur.nom}` : "Utilisateur"}
                </span>
                {m.auteur?.role && <span>· {ROLE_LABELS[m.auteur.role]}</span>}
                <span>· {new Date(m.created_at).toLocaleString("fr-FR")}</span>
              </div>
              <p className="whitespace-pre-wrap">{m.contenu}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={envoyer} className="flex flex-wrap gap-2">
        <label htmlFor="nouveau-message" className="sr-only">
          Nouveau message
        </label>
        <textarea
          id="nouveau-message"
          ref={textareaRef}
          placeholder="Écrire un message à l'équipe du projet…"
          rows={2}
          className="min-w-[240px] flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
        />
        <button type="submit" disabled={pending} className="btn btn-primary self-start">
          Envoyer
        </button>
      </form>
    </section>
  );
}
