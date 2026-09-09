"use client";

import { useRef, useTransition } from "react";
import { updateEtapeStatut } from "@/app/actions";
import type { EtapeStatut } from "@/lib/types";

export function EtapeAvisForm({
  projetId,
  etapeId,
  statut,
  avis,
}: {
  projetId: string;
  etapeId: string;
  statut: EtapeStatut;
  avis: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    const valeur = inputRef.current?.value ?? "";
    startTransition(() => updateEtapeStatut(projetId, etapeId, statut, valeur));
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-wrap items-start gap-2">
      <label htmlFor="avis-etape" className="sr-only">
        Avis sur cette étape
      </label>
      <textarea
        id="avis-etape"
        ref={inputRef}
        defaultValue={avis ?? ""}
        placeholder="Avis sur cette étape (visible par toute l'équipe)…"
        rows={2}
        className="min-w-[240px] flex-1 rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--color-border)" }}
      />
      <button type="submit" disabled={pending} className="btn btn-outline">
        Enregistrer l&apos;avis
      </button>
    </form>
  );
}
