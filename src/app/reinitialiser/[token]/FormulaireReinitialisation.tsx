"use client";

import { useActionState } from "react";
import { appliquerReinitialisation } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

export function FormulaireReinitialisation({ token }: { token: string }) {
  const [state, action, pending] = useActionState(appliquerReinitialisation, {});

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <label htmlFor="password" className="mb-1 block text-sm font-medium">
        Nouveau mot de passe
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--color-border)" }}
      />
      <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
        Huit caractères au minimum.
      </p>
      <FieldError message={state.error} />
      <button type="submit" disabled={pending} className="btn btn-primary mt-4 w-full">
        {pending ? "Enregistrement…" : "Enregistrer et me connecter"}
      </button>
    </form>
  );
}
