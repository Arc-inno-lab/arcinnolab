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

        <button type="submit" disabled={pending} className="btn btn-primary mt-5 w-full">
          {pending ? "Création..." : "Créer le projet"}
        </button>
      </form>
    </div>
  );
}
