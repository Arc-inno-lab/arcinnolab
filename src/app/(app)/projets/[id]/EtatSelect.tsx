"use client";

import { useTransition } from "react";
import { updateProjetEtat } from "@/app/actions";
import { ETAT_LABELS, type ProjetEtat } from "@/lib/types";

const ETATS: ProjetEtat[] = ["brouillon", "soumis", "valide", "en_cours", "archive"];

export function EtatSelect({ projetId, etat }: { projetId: string; etat: ProjetEtat }) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span style={{ color: "var(--color-muted)" }}>État :</span>
      <select
        defaultValue={etat}
        disabled={pending}
        onChange={(e) => startTransition(() => updateProjetEtat(projetId, e.target.value))}
        className="rounded-md border px-2 py-1"
        style={{ borderColor: "var(--color-border)" }}
      >
        {ETATS.map((e) => (
          <option key={e} value={e}>
            {ETAT_LABELS[e]}
          </option>
        ))}
      </select>
    </label>
  );
}
