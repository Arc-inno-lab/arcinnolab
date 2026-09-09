"use client";

import { useActionState } from "react";
import { createProjet } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

export function ProjetForm() {
  const [state, formAction, pending] = useActionState(createProjet, {});

  return (
    <div
      className="rounded-lg border p-6"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <form action={formAction} noValidate>
        <label htmlFor="titre" className="mb-1 block text-sm font-medium">
          Titre du projet
        </label>
        <input
          id="titre"
          name="titre"
          required
          className="w-full rounded-md border px-3 py-2"
          style={{ borderColor: "var(--color-border)" }}
        />

        <label htmlFor="description" className="mb-1 mt-4 block text-sm font-medium">
          Description <span style={{ color: "var(--color-muted)" }}>(facultatif)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="w-full rounded-md border px-3 py-2"
          style={{ borderColor: "var(--color-border)" }}
        />

        <FieldError message={state.error} />

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
          style={{ background: "var(--color-primary)" }}
        >
          {pending ? "Création..." : "Créer le projet"}
        </button>
      </form>
    </div>
  );
}
