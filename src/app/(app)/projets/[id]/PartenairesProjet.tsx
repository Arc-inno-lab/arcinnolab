"use client";

import { useActionState, useTransition } from "react";
import { detacherPartenaire, rattacherPartenaire } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/types";

/**
 * Les partenaires rattachés au projet.
 *
 * Ce rattachement n'est pas décoratif : c'est lui qui décide qui le porteur
 * voit dans l'annuaire et à qui il peut écrire. Rattacher tout le consortium à
 * chaque projet reviendrait à rouvrir l'annuaire à tout le monde.
 */
export function PartenairesProjet({
  projetId,
  rattaches,
  disponibles,
  referent,
  peutGerer,
}: {
  projetId: string;
  rattaches: Profile[];
  disponibles: Profile[];
  referent: { nom: string; prenom: string; photo_url: string | null } | null;
  peutGerer: boolean;
}) {
  const [state, action, pending] = useActionState(rattacherPartenaire, {});
  const [retrait, startRetrait] = useTransition();

  return (
    <section aria-labelledby="partenaires-heading" className="mb-8">
      <h2 id="partenaires-heading" className="mb-1 text-lg font-medium">
        Partenaires sur ce projet ({rattaches.length + (referent ? 1 : 0)})
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Seules ces personnes sont visibles par le porteur et joignables par lui.
        Le reste du consortium ne lui apparaît pas.
      </p>

      <ul className="mb-3 flex flex-col gap-2">
        {referent && (
          <li className="card flex items-center gap-3 p-3 text-sm">
            <Avatar nom={referent.nom} prenom={referent.prenom} photoUrl={referent.photo_url} size="sm" />
            <span className="font-medium">
              {referent.prenom} {referent.nom}
            </span>
            <span className="tag" style={{ "--tag-bg": "var(--color-primary-soft)", "--tag-color": "var(--color-primary)" } as React.CSSProperties}>
              référent
            </span>
          </li>
        )}
        {rattaches.map((p) => (
          <li key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar nom={p.nom} prenom={p.prenom} photoUrl={p.photo_url} size="sm" />
              <div>
                <span className="font-medium">
                  {p.prenom} {p.nom}
                </span>
                {p.organisation && (
                  <span style={{ color: "var(--color-muted)" }}> · {p.organisation}</span>
                )}
              </div>
            </div>
            {peutGerer && (
              <button
                type="button"
                disabled={retrait}
                onClick={() => startRetrait(() => detacherPartenaire(projetId, p.id))}
                className="btn btn-outline text-xs"
              >
                Retirer
              </button>
            )}
          </li>
        ))}
      </ul>

      {peutGerer && (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="partenaire" className="mb-1 block text-sm font-medium">
              Rattacher un partenaire
            </label>
            <select
              id="partenaire"
              name="partenaire_id"
              required
              disabled={!disponibles.length}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--color-border)" }}
            >
              <option value="">
                {disponibles.length ? "Choisir…" : "Aucun autre partenaire disponible"}
              </option>
              {disponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prenom} {p.nom}
                  {p.organisation ? ` — ${p.organisation}` : ""}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="projet_id" value={projetId} />
          <button type="submit" disabled={pending || !disponibles.length} className="btn btn-outline">
            {pending ? "…" : "Rattacher"}
          </button>
          <FieldError message={state.error} />
        </form>
      )}
    </section>
  );
}
