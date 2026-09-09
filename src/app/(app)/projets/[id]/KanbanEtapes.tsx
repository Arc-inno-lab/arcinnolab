"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createEtape, updateEtapeStatut } from "@/app/actions";
import { ETAPE_STATUT_LABELS, ETAPE_STATUT_COLORS, type EtapeProjet, type EtapeStatut } from "@/lib/types";

const STATUTS: EtapeStatut[] = ["a_faire", "en_cours", "validee", "refusee"];
const STATUT_SHORT: Record<EtapeStatut, string> = {
  a_faire: "À",
  en_cours: "En",
  validee: "Val",
  refusee: "Ref",
};

export function KanbanEtapes({
  projetId,
  etapes,
  peutGerer,
  counts,
}: {
  projetId: string;
  etapes: EtapeProjet[];
  peutGerer: boolean;
  counts: Record<string, { messages: number; documents: number }>;
}) {
  const [pending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<EtapeStatut | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function ajouter(e: React.FormEvent) {
    e.preventDefault();
    const titre = inputRef.current?.value ?? "";
    if (!titre.trim()) return;
    startTransition(() => createEtape(projetId, titre));
    if (inputRef.current) inputRef.current.value = "";
  }

  function deplacer(etapeId: string, statut: EtapeStatut) {
    startTransition(() => updateEtapeStatut(projetId, etapeId, statut));
  }

  return (
    <section aria-labelledby="etapes-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="etapes-heading" className="text-lg font-medium">
          Passeport projet — étapes ({etapes.length})
        </h2>
      </div>

      <div className="kanban-board">
        {STATUTS.map((statut) => {
          const cardsInColumn = etapes.filter((e) => e.statut === statut);
          return (
            <div
              key={statut}
              className={`kanban-column${overColumn === statut ? " is-dragover" : ""}`}
              onDragOver={(e) => {
                if (!peutGerer) return;
                e.preventDefault();
                setOverColumn(statut);
              }}
              onDragLeave={() => setOverColumn((c) => (c === statut ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverColumn(null);
                const etapeId = e.dataTransfer.getData("text/plain");
                if (etapeId) deplacer(etapeId, statut);
              }}
            >
              <div className="kanban-column-title" style={{ color: ETAPE_STATUT_COLORS[statut] }}>
                <span aria-hidden="true">●</span> {ETAPE_STATUT_LABELS[statut]} ({cardsInColumn.length})
              </div>

              {cardsInColumn.map((etape) => {
                const c = counts[etape.id] ?? { messages: 0, documents: 0 };
                return (
                  <article
                    key={etape.id}
                    className={`kanban-card${draggingId === etape.id ? " is-dragging" : ""}`}
                    draggable={peutGerer}
                    onDragStart={(e) => {
                      setDraggingId(etape.id);
                      e.dataTransfer.setData("text/plain", etape.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <Link
                      href={`/projets/${projetId}/etapes/${etape.id}`}
                      className="font-medium hover:underline"
                    >
                      {etape.titre}
                    </Link>

                    {etape.avis && (
                      <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--color-muted)" }}>
                        Avis : {etape.avis}
                      </p>
                    )}

                    <div className="kanban-card-meta">
                      <span>💬 {c.messages}</span>
                      <span>📎 {c.documents}</span>
                    </div>

                    {peutGerer && (
                      <div className="pill-group mt-2" role="group" aria-label={`Changer le statut de ${etape.titre}`}>
                        {STATUTS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={pending || s === etape.statut}
                            aria-pressed={s === etape.statut}
                            aria-label={`Marquer « ${etape.titre} » comme ${ETAPE_STATUT_LABELS[s]}`}
                            onClick={() => deplacer(etape.id, s)}
                            className="pill"
                            style={{ "--pill-color": ETAPE_STATUT_COLORS[s], minHeight: "1.75rem", padding: "0.2rem 0.55rem" } as React.CSSProperties}
                          >
                            {STATUT_SHORT[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}

              {!cardsInColumn.length && (
                <p className="px-1 text-xs" style={{ color: "var(--color-muted)" }}>
                  Aucune étape.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {peutGerer && (
        <form onSubmit={ajouter} className="mt-3 flex flex-wrap gap-2">
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
