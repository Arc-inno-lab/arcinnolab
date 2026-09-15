"use client";

import { useActionState, useState } from "react";
import { updateProjetDescription } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

/**
 * Le descriptif du projet, modifiable par le porteur comme par son référent.
 *
 * C'est son projet : personne n'est mieux placé pour le raconter, et un texte
 * qu'il ne peut pas corriger vieillit sans que personne s'en aperçoive.
 */
export function DescriptionProjet({
  projetId,
  description,
  peutEditer,
}: {
  projetId: string;
  description: string | null;
  peutEditer: boolean;
}) {
  const [state, action, pending] = useActionState(updateProjetDescription, {});
  const [edition, setEdition] = useState(false);

  if (!peutEditer && !description) return null;

  if (!peutEditer || (!edition && !state.error)) {
    return (
      <div className="card mb-8 p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Description</h2>
          {peutEditer && (
            <button type="button" onClick={() => setEdition(true)} className="btn btn-outline text-xs">
              Modifier
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm">
          {description || (
            <span style={{ color: "var(--color-muted)" }}>
              Aucune description pour l&apos;instant.
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card mb-8 p-5">
      <h2 className="mb-2 text-lg font-medium">Description</h2>
      <input type="hidden" name="projet_id" value={projetId} />
      <label htmlFor="description-projet" className="sr-only">
        Description du projet
      </label>
      <textarea
        id="description-projet"
        name="description"
        rows={6}
        defaultValue={description ?? ""}
        placeholder="Ce que fait le projet, où il en est, ce qu'il cherche…"
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--color-border)" }}
      />
      <FieldError message={state.error} />
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setEdition(false)} className="btn btn-outline">
          Annuler
        </button>
      </div>
    </form>
  );
}
