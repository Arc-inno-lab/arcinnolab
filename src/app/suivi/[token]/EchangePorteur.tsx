"use client";

import { useActionState } from "react";
import { posterMessageSuivi } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { MessageSuivi } from "@/lib/types";

/**
 * Le fil d'échange vu du porteur.
 *
 * Il n'a pas de compte : c'est son lien de suivi qui l'identifie. Sans ce fil,
 * la page lui annonçait « nous revenons vers vous » sans lui laisser le moindre
 * moyen de poser une question — la promesse du manifeste tenait alors du
 * slogan.
 */
export function EchangePorteur({
  token,
  messages,
}: {
  token: string;
  messages: MessageSuivi[];
}) {
  const [state, action, pending] = useActionState(posterMessageSuivi, {});

  return (
    <section className="card mb-5 p-6">
      <h2 className="mb-1 text-lg font-medium">Échanger avec l&apos;équipe</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        Posez vos questions ici. Vos messages arrivent directement à
        l&apos;équipe ArcInnoLab, et leurs réponses s&apos;affichent sur cette
        page.
      </p>

      {messages.length > 0 && (
        <ul className="mb-5 flex flex-col gap-3">
          {messages.map((m, i) => {
            const equipe = m.auteur === "equipe";
            return (
              <li
                key={i}
                className="rounded-md p-3"
                style={{
                  background: equipe ? "var(--color-surface-alt)" : "var(--color-surface)",
                  border: equipe ? "none" : "1px solid var(--color-border)",
                }}
              >
                <p
                  className="mb-1 text-xs font-medium"
                  style={{ color: "var(--color-muted)" }}
                >
                  {equipe ? "Équipe ArcInnoLab" : "Vous"}
                  {" · "}
                  {new Date(m.envoye_le).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="whitespace-pre-wrap text-sm">{m.contenu}</p>
              </li>
            );
          })}
        </ul>
      )}

      {state.success && (
        <p className="mb-3 text-sm" style={{ color: "var(--color-success)" }} role="status">
          Message envoyé. Rechargez la page pour le voir apparaître.
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <label htmlFor="contenu" className="mb-1 block text-sm font-medium">
          Votre message
        </label>
        <textarea
          id="contenu"
          name="contenu"
          rows={4}
          required
          placeholder="Une question, une précision sur votre projet, une disponibilité…"
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
        />
        <FieldError message={state.error} />
        <button type="submit" disabled={pending} className="btn btn-primary mt-3">
          {pending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
    </section>
  );
}
