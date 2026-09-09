"use client";

import { useRef, useTransition } from "react";
import { createMessageProjet } from "@/app/actions";
import { ROLE_LABELS, type MessageProjet } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

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
    <section aria-labelledby="messages-heading" className="mb-8">
      <h2 id="messages-heading" className="mb-3 text-lg font-medium">
        Fil du projet ({messages.length})
      </h2>

      <div className="card p-4">
        <form onSubmit={envoyer} className="mb-2 flex flex-wrap gap-2">
          <label htmlFor="nouveau-message" className="sr-only">
            Nouveau message
          </label>
          <textarea
            id="nouveau-message"
            ref={textareaRef}
            placeholder="Partager une nouvelle avec l'équipe du projet…"
            rows={2}
            className="min-w-[240px] flex-1 rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          />
          <button type="submit" disabled={pending} className="btn btn-primary self-start">
            Publier
          </button>
        </form>

        {!messages.length ? (
          <p className="pt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Aucun message pour le moment. Lancez la discussion avec l&apos;équipe du projet.
          </p>
        ) : (
          <ul className="mt-2 border-t pt-2" style={{ borderColor: "var(--color-border)" }}>
            {[...messages].reverse().map((m) => (
              <li key={m.id} className="feed-item fade-up">
                <Avatar nom={m.auteur?.nom} prenom={m.auteur?.prenom} photoUrl={m.auteur?.photo_url} size="sm" />
                <div className="feed-bubble">
                  <div className="feed-header">
                    <span className="font-medium">
                      {m.auteur ? `${m.auteur.prenom} ${m.auteur.nom}` : "Utilisateur"}
                    </span>
                    {m.auteur?.role && (
                      <span style={{ color: "var(--color-muted)" }}>· {ROLE_LABELS[m.auteur.role]}</span>
                    )}
                    <span style={{ color: "var(--color-muted)" }}>
                      · {new Date(m.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <p className="feed-content">{m.contenu}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
