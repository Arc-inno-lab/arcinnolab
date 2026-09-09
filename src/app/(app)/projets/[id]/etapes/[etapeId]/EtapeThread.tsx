"use client";

import { useRef, useTransition } from "react";
import { createEtapeMessage } from "@/app/actions";
import { ROLE_LABELS, type MessageProjet } from "@/lib/types";
import { Avatar } from "@/components/Avatar";

export function EtapeThread({
  projetId,
  etapeId,
  messages,
}: {
  projetId: string;
  etapeId: string;
  messages: MessageProjet[];
}) {
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const contenu = textareaRef.current?.value ?? "";
    if (!contenu.trim()) return;
    startTransition(() => createEtapeMessage(projetId, etapeId, contenu));
    if (textareaRef.current) textareaRef.current.value = "";
  }

  return (
    <div>
      {!messages.length ? (
        <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucun échange pour le moment sur cette étape.
        </p>
      ) : (
        <ul className="mb-4">
          {messages.map((m) => (
            <li key={m.id} className="feed-item">
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

      <form onSubmit={envoyer} className="flex flex-wrap gap-2">
        <label htmlFor="nouveau-message-etape" className="sr-only">
          Nouveau message sur cette étape
        </label>
        <textarea
          id="nouveau-message-etape"
          ref={textareaRef}
          placeholder="Écrire un message sur cette étape…"
          rows={2}
          className="min-w-[240px] flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
        />
        <button type="submit" disabled={pending} className="btn btn-primary self-start">
          Envoyer
        </button>
      </form>
    </div>
  );
}
