"use client";

import { useActionState } from "react";
import { bootstrapAdmin } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

export function BootstrapForm() {
  const [state, formAction, pending] = useActionState(bootstrapAdmin, {});

  return (
    <form action={formAction} noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="prenom" className="mb-1 block text-sm font-medium">
            Prénom
          </label>
          <input
            id="prenom"
            name="prenom"
            required
            className="w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
        <div>
          <label htmlFor="nom" className="mb-1 block text-sm font-medium">
            Nom
          </label>
          <input
            id="nom"
            name="nom"
            required
            className="w-full rounded-md border px-3 py-2"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
      </div>

      <label htmlFor="email" className="mb-1 mt-4 block text-sm font-medium">
        Adresse email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="w-full rounded-md border px-3 py-2"
        style={{ borderColor: "var(--color-border)" }}
      />

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

      <button type="submit" disabled={pending} className="btn btn-primary mt-5 w-full">
        {pending ? "Création..." : "Créer le compte administrateur"}
      </button>
    </form>
  );
}
