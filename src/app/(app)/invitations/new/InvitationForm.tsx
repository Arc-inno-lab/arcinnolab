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
    <div className="card p-6">
      <form action={formAction} noValidate>
        {projetId && <input type="hidden" name="projet_id" value={projetId} />}

        {projetId && (
          <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
            Créez la fiche du porteur : le lien d&apos;invitation est généré automatiquement dès
            l&apos;enregistrement.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prenom" className="mb-1 block text-sm font-medium">
              Prénom <span style={{ color: "var(--color-muted)" }}>(facultatif)</span>
            </label>
            <input
              id="prenom"
              name="prenom"
              className="w-full rounded-md border px-3 py-2"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
          <div>
            <label htmlFor="nom" className="mb-1 block text-sm font-medium">
              Nom <span style={{ color: "var(--color-muted)" }}>(facultatif)</span>
            </label>
            <input
              id="nom"
              name="nom"
              className="w-full rounded-md border px-3 py-2"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>
        </div>

        <label htmlFor="organisation" className="mb-1 mt-4 block text-sm font-medium">
          Organisation <span style={{ color: "var(--color-muted)" }}>(facultatif)</span>
        </label>
        <input
          id="organisation"
          name="organisation"
          className="w-full rounded-md border px-3 py-2"
          style={{ borderColor: "var(--color-border)" }}
        />

        <label htmlFor="email" className="mb-1 mt-4 block text-sm font-medium">
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

        <button type="submit" disabled={pending} className="btn btn-primary mt-5 w-full">
          {pending ? "Génération..." : projetId ? "Créer la fiche et générer l'invitation" : "Générer le lien d'invitation"}
        </button>
      </form>

      {state.success && state.inviteUrl && (
        <div className="mt-5 rounded-md p-4" style={{ background: "var(--color-success-soft)" }}>
          <p className="mb-2 text-sm font-medium" style={{ color: "var(--color-success)" }}>
            Invitation créée. Envoyez ce lien à la personne concernée :
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs">{state.inviteUrl}</code>
            <button type="button" onClick={copyLink} className="btn btn-outline" style={{ minHeight: "36px", padding: "0.375rem 0.75rem" }}>
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--color-success)" }}>
            L&apos;envoi automatique par email n&apos;est pas encore branché en V0 — le lien est à
            transmettre manuellement pour l&apos;instant.
          </p>
        </div>
      )}
    </div>
  );
}
