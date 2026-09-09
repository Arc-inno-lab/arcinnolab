"use client";

import { useRef, useTransition } from "react";
import { createEtape, updateEtapeStatut } from "@/app/actions";
import { ETAPE_STATUT_LABELS, type EtapeProjet, type EtapeStatut } from "@/lib/types";

const STATUTS: EtapeStatut[] = ["a_faire", "en_cours", "validee", "refusee"];

const BADGE_COLORS: Record<EtapeStatut, string> = {
  a_faire: "var(--color-muted)",
  en_cours: "var(--color-primary)",
  validee: "var(--color-success)",
  refusee: "var(--color-danger)",
};

export function EtapesSection({
  projetId,
  etapes,
  peutGerer,
}: {
  projetId: string;
  etapes: EtapeProjet[];
  peutGerer: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function ajouter(e: React.FormEvent) {
    e.preventDefault();
    const titre = inputRef.current?.value ?? "";
    if (!titre.trim()) return;
    startTransition(() => createEtape(projetId, titre));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section aria-labelledby="etapes-heading" className="mb-6">
      <h2 id="etapes-heading" className="mb-3 text-lg font-medium">
        Passeport projet — étapes ({etapes.length})
      </h2>

      {!etapes.length ? (
        <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
          Aucune étape définie pour le moment.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {etapes.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border p-3 text-sm"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{e.titre}</span>
                {peutGerer ? (
                  <select
                    defaultValue={e.statut}
                    disabled={pending}
                    onChange={(ev) =>
                      startTransition(() => updateEtapeStatut(projetId, e.id, ev.target.value))
                    }
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {STATUTS.map((s) => (
                      <option key={s} value={s}>
                        {ETAPE_STATUT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ color: BADGE_COLORS[e.statut] }}
                  >
                    {ETAPE_STATUT_LABELS[e.statut]}
                  </span>
                )}
              </div>
              {e.avis && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
                  Avis : {e.avis}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {peutGerer && (
        <form onSubmit={ajouter} className="flex flex-wrap gap-2">
          <label htmlFor="nouvelle-etape" className="sr-only">
            Nouvelle étape
          </label>
          <input
            id="nouvelle-etape"
            ref={inputRef}
            placeholder="Nouvelle étape (ex : Dossier de financement déposé)"
            className="min-w-[240px] flex-1 rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          />
          <button type="submit" disabled={pending} className="btn btn-outline">
            + Ajouter
          </button>
        </form>
      )}
    </section>
  );
}
