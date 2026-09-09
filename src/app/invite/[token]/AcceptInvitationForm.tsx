"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

export function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(acceptInvitation, {});

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="token" value={token} />

      <label className="mb-1 block text-sm font-medium">Adresse email</label>
      <p className="mb-4 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
        {email}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="prenom" className="mb-1 block text-sm font-medium">
            Prénom
          </label>
          <input id="prenom" name="prenom" required className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--color-border)" }} />
        </div>
        <div>
          <label htmlFor="nom" className="mb-1 block text-sm font-medium">
            Nom
          </label>
          <input id="nom" name="nom" required className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--color-border)" }} />
        </div>
      </div>

      <label htmlFor="organisation" className="mb-1 mt-4 block text-sm font-medium">
        Organisation <span style={{ color: "var(--color-muted)" }}>(facultatif)</span>
      </label>
      <input id="organisation" name="organisation" className="w-full rounded-md border px-3 py-2" style={{ borderColor: "var(--color-border)" }} />

      <label htmlFor="password" className="mb-1 mt-4 block text-sm font-medium">
        Mot de passe
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        aria-describedby="password-hint"
        className="w-full rounded-md border px-3 py-2"
        style={{ borderColor: "var(--color-border)" }}
      />
      <p id="password-hint" className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
        8 caractères minimum.
      </p>

      <FieldError message={state.error} />

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {pending ? "Création..." : "Créer mon compte"}
      </button>
    </form>
  );
}
