"use client";

import { useActionState, useState } from "react";
import { createInvitation } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

export function InvitationForm({
  canInvitePartenaire,
  projetId,
}: {
  canInvitePartenaire: boolean;
  /** Invitation lancée depuis une fiche projet : force le rôle Porteur et lie l'invitation au projet. */
  projetId?: string;
}) {
  const [state, formAction, pending] = useActionState(createInvitation, {});
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible : le lien reste affiché et sélectionnable manuellement.
    }
  }

  return (
    <div
      className="rounded-lg border p-6"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <form action={formAction} noValidate>
        {projetId && <input type="hidden" name="projet_id" value={projetId} />}

        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Adresse email de la personne invitée
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border px-3 py-2"
          style={{ borderColor: "var(--color-border)" }}
        />

        {projetId ? (
          <input type="hidden" name="role_cible" value="porteur" />
        ) : (
          <fieldset className="mt-4">
            <legend className="mb-1 block text-sm font-medium">Rôle attribué</legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="role_cible" value="porteur" defaultChecked />
                Porteur de projet
              </label>
              {canInvitePartenaire && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="role_cible" value="partenaire" />
                  Partenaire ArcInnoLab
                </label>
              )}
            </div>
          </fieldset>
        )}

        <FieldError message={state.error} />

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
          style={{ background: "var(--color-primary)" }}
        >
          {pending ? "Génération..." : "Générer le lien d'invitation"}
        </button>
      </form>

      {state.success && state.inviteUrl && (
        <div className="mt-5 rounded-md bg-green-50 p-4">
          <p className="mb-2 text-sm font-medium text-green-900">Invitation créée. Envoyez ce lien à la personne concernée :</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs">{state.inviteUrl}</code>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-green-700 px-3 py-1 text-xs font-medium text-green-900"
            >
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-xs text-green-800">
            L&apos;envoi automatique par email n&apos;est pas encore branché en V0 — le lien est à
            transmettre manuellement pour l&apos;instant.
          </p>
        </div>
      )}
    </div>
  );
}
