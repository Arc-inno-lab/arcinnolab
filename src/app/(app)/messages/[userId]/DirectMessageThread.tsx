"use client";

import { useRef, useTransition } from "react";
import { sendDirectMessage } from "@/app/actions";
import type { DirectMessage } from "@/lib/types";

export function DirectMessageThread({
  otherId,
  meId,
  messages,
}: {
  otherId: string;
  meId: string;
  messages: DirectMessage[];
}) {
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const contenu = textareaRef.current?.value ?? "";
    if (!contenu.trim()) return;
    startTransition(() => sendDirectMessage(otherId, contenu));
    if (textareaRef.current) textareaRef.current.value = "";
  }

  return (
    <div>
      {!messages.length ? (
        <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucun message pour le moment. Dites bonjour !
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.expediteur_id === meId;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words"
                  style={
                    mine
                      ? { background: "var(--gradient-brand)", color: "#fff" }
                      : { background: "var(--color-surface-alt)", color: "var(--color-text)" }
                  }
                >
                  {m.contenu}
                  <div
                    className="mt-1 text-[10px] opacity-70"
                    style={{ color: mine ? "rgba(255,255,255,0.85)" : "var(--color-muted)" }}
                  >
                    {new Date(m.date_envoi).toLocaleString("fr-FR")}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={envoyer} className="flex flex-wrap gap-2">
        <label htmlFor="nouveau-message-direct" className="sr-only">
          Nouveau message
        </label>
        <textarea
          id="nouveau-message-direct"
          ref={textareaRef}
          placeholder="Écrire un message…"
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
