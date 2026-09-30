"use client";

import { useTransition } from "react";
import { updateProjetEtat } from "@/app/actions";
import { ETAT_LABELS, ETATS_PROPOSES, type ProjetEtat } from "@/lib/types";

/**
 * L'état du projet : en cours, en pause, terminé. Les états hérités de la V0
 * (brouillon, soumis, validé) décrivaient une candidature, pas un projet ; ils
 * ne sont plus proposés.
 */
export function EtatSelect({ projetId, etat }: { projetId: string; etat: ProjetEtat }) {
  const [pending, startTransition] = useTransition();
  const options = ETATS_PROPOSES.includes(etat) ? ETATS_PROPOSES : [etat, ...ETATS_PROPOSES];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="etat-projet" className="text-xs" style={{ color: "var(--color-muted)" }}>
        État du projet
      </label>
      <select
        id="etat-projet"
        value={etat}
        disabled={pending}
        onChange={(e) => startTransition(() => updateProjetEtat(projetId, e.target.value))}
        className="rounded-lg border px-3 text-sm font-medium"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        {options.map((e) => (
          <option key={e} value={e}>
            {ETAT_LABELS[e]}
          </option>
        ))}
      </select>
    </div>
  );
}
