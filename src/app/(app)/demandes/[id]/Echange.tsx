"use client";

import { useActionState, useState } from "react";
import { repondreAuPorteur } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { MessageDemande } from "@/lib/types";

/**
 * Le fil d'échange entre l'équipe et le porteur, vu du côté équipe.
 *
 * Il existe parce que la page de suivi promet « nous revenons vers vous » sans
 * offrir aucun moyen de le faire dans l'application : le porteur restait devant
 * un écran muet, et l'équipe n'avait que le téléphone ou l'e-mail personnel.
 */
export function Echange({
  demandeId,
  messages,
  prenomPorteur,
  lienSuivi,
}: {
  demandeId: string;
  messages: MessageDemande[];
  prenomPorteur: string;
  lienSuivi: string;
}) {
  const [state, action, pending] = useActionState(repondreAuPorteur, {});
  const [copie, setCopie] = useState(false);

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(lienSuivi);
      setCopie(true);
      setTimeout(() => setCopie(false), 3000);
    } catch {
      setCopie(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Échanges avec {prenomPorteur}</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        Ces messages s&apos;affichent sur sa page de suivi. Il peut vous répondre
        depuis cette même page, sans compte.
      </p>

      <div
        className="mb-4 rounded-md p-3"
        style={{ background: "var(--color-surface-alt)" }}
      >
        <p className="mb-1 text-xs font-medium">Sa page de suivi</p>
        <p className="mb-2 overflow-x-auto text-xs">
          <code>{lienSuivi}</code>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copierLien} className="btn btn-outline text-xs">
            {copie ? "Lien copié" : "Copier le lien"}
          </button>
          <a
            href={lienSuivi}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline text-xs"
          >
            Voir ce qu&apos;il voit
          </a>
        </div>
      </div>

      {messages.length > 0 ? (
        <ul className="mb-4 flex flex-col gap-3">
          {messages.map((m) => {
            const equipe = m.auteur === "equipe";
            return (
              <li
                key={m.id}
                className="rounded-md p-3"
                style={{
                  background: equipe
                    ? "var(--color-surface-alt)"
                    : "var(--color-surface)",
                  border: equipe ? "none" : "1px solid var(--color-border)",
                }}
              >
                <p className="mb-1 text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                  {equipe
                    ? m.profil
                      ? `${m.profil.prenom} ${m.profil.nom} · équipe`
                      : "Équipe ArcInnoLab"
                    : prenomPorteur}
                  {" · "}
                  {new Date(m.created_at).toLocaleString("fr-FR", {
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
      ) : (
        <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucun échange pour l&apos;instant.
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="demande_id" value={demandeId} />
        <label htmlFor="contenu" className="mb-1 block text-sm font-medium">
          Écrire à {prenomPorteur}
        </label>
        <textarea
          id="contenu"
          name="contenu"
          rows={4}
          required
          placeholder="Proposer un rendez-vous, demander une précision, donner des nouvelles…"
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
