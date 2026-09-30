"use client";

import { useActionState, useEffect, useRef } from "react";
import { posterMessageSuivi } from "@/app/actions";
import type { MessageSuivi } from "@/lib/types";

function quand(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Le fil d'échange vu du porteur, sans compte : son lien de suivi
 * l'identifie. Ses messages à droite, ceux de l'équipe à gauche avec le
 * prénom de qui a répondu — on parle à quelqu'un, pas à un guichet.
 */
export function EchangePorteur({
  token,
  messages,
  coach,
}: {
  token: string;
  messages: MessageSuivi[];
  coach: string | null;
}) {
  const [state, action, pending] = useActionState(posterMessageSuivi, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <section className="mb-6" aria-labelledby="echanges">
      <h2 id="echanges" className="mb-3 text-[20px] font-bold">
        Vos échanges avec {coach ?? "l'équipe"}
      </h2>

      {messages.length > 0 ? (
        <ul className="mb-4 flex flex-col gap-3">
          {messages.map((m, i) => {
            const equipe = m.auteur === "equipe";
            return (
              <li key={i} className={`flex flex-col gap-1 ${equipe ? "items-start" : "items-end"}`}>
                <p
                  className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[17px] leading-snug"
                  style={
                    equipe
                      ? { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderBottomLeftRadius: 6 }
                      : { background: "var(--color-primary)", color: "#fff", borderBottomRightRadius: 6 }
                  }
                >
                  {m.contenu}
                </p>
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {equipe ? (m.auteur_prenom ?? "L'équipe") : "Vous"} · {quand(m.envoye_le)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-4" style={{ color: "var(--color-muted)" }}>
          Une question ? Écrivez ici : {coach ?? "l'équipe"} vous répond sur cette page.
        </p>
      )}

      <form ref={formRef} action={action}>
        <input type="hidden" name="token" value={token} />
        <label htmlFor="contenu" className="sr-only">
          Votre message
        </label>
        <textarea
          id="contenu"
          name="contenu"
          rows={3}
          required
          placeholder="Écrivez votre réponse ici…"
          className="champ-grand"
        />
        {state.error && (
          <p role="alert" className="mt-2 text-[15px] font-semibold" style={{ color: "var(--color-danger)" }}>
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="mt-2 text-[15px] font-semibold" style={{ color: "var(--color-success)" }}>
            Message envoyé.
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary btn-grand mt-3 w-full">
          {pending ? "Envoi…" : coach ? `Envoyer à ${coach}` : "Envoyer"}
        </button>
      </form>
    </section>
  );
}
