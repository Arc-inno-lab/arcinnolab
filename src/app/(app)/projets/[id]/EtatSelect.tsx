"use client";

import { useTransition } from "react";
import { updateProjetEtat } from "@/app/actions";
import { ETAT_LABELS, ETAT_COLORS, type ProjetEtat } from "@/lib/types";

const ETATS: ProjetEtat[] = ["brouillon", "soumis", "valide", "en_cours", "archive"];

export function EtatSelect({ projetId, etat }: { projetId: string; etat: ProjetEtat }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="pill-group" role="group" aria-label="État du projet">
      {ETATS.map((e) => (
        <button
          key={e}
          type="button"
          disabled={pending || e === etat}
          aria-pressed={e === etat}
          onClick={() => startTransition(() => updateProjetEtat(projetId, e))}
          className="pill"
          style={{ "--pill-color": ETAT_COLORS[e] } as React.CSSProperties}
        >
          {ETAT_LABELS[e]}
        </button>
      ))}
    </div>
  );
}
