"use client";

import { useRef, useState, useTransition } from "react";
import { createEtape, updateEtapeStatut } from "@/app/actions";
import {
  ETAPE_STATUT_LABELS,
  ETAPE_STATUT_COLORS,
  type EtapeProjet,
  type EtapeStatut,
  type MessageProjet,
} from "@/lib/types";
import { PanneauEtape } from "./PanneauEtape";

const STATUTS: EtapeStatut[] = ["a_faire", "en_cours", "validee", "refusee"];

/**
 * Le tableau des étapes.
 *
 * Cliquer sur une carte n'emmène plus sur une autre page : un panneau s'ouvre
 * à droite, le tableau reste visible derrière. C'est la différence entre
 * consulter une liste de fiches et piloter un plan de travail.
 *
 * Le glisser-déposer, lui, est réservé aux colonnes que la personne a le droit
 * de choisir : un porteur mène son travail entre « À faire » et « En cours »,
 * la validation reste l'avis du partenaire référent (la base le vérifie aussi,
 * cf. migration 016).
 */
export function KanbanEtapes({
  projetId,
  etapes,
  peutEditer,
  peutValider,
  messagesParEtape,
  documentsParEtape,
}: {
  projetId: string;
  etapes: EtapeProjet[];
  peutEditer: boolean;
  peutValider: boolean;
  messagesParEtape: Record<string, MessageProjet[]>;
  documentsParEtape: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<EtapeStatut | null>(null);
  const [ouverteId, setOuverteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ouverte = etapes.find((e) => e.id === ouverteId) ?? null;

  function colonneAutorisee(statut: EtapeStatut) {
    if (!peutEditer) return false;
    if (statut === "validee" || statut === "refusee") return peutValider;
    return true;
  }

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

  const validees = etapes.filter((e) => e.statut === "validee").length;
  const enRetard = etapes.filter(
    (e) =>
      e.date_echeance &&
      e.statut !== "validee" &&
      new Date(e.date_echeance) < new Date(new Date().toDateString())
  ).length;
  const avancement = etapes.length ? Math.round((validees / etapes.length) * 100) : 0;

  return (
    <section aria-labelledby="etapes-heading" className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="etapes-heading" className="text-lg font-medium">
            Passeport projet
          </h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Les jalons de l&apos;accompagnement. Cliquez sur une étape pour
            l&apos;ouvrir : description, date butoir, statut et discussion
            s&apos;affichent à droite, sans quitter le tableau.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">
            {validees}
            <span className="text-base" style={{ color: "var(--color-muted)" }}>
              /{etapes.length}
            </span>
          </p>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            étapes validées
          </p>
        </div>
      </div>

      {/* La barre d'avancement dit en un coup d'œil ce que quatre colonnes de
          cartes obligeaient à compter à la main. */}
      <div
        className="mb-1 h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-alt)" }}
        role="img"
        aria-label={`Avancement : ${avancement} %`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${avancement}%`, background: "var(--color-success)" }}
        />
      </div>
      {enRetard > 0 && (
        <p className="mb-3 text-xs font-medium" style={{ color: "var(--color-danger)" }}>
          {enRetard === 1
            ? "Une étape a dépassé sa date butoir."
            : `${enRetard} étapes ont dépassé leur date butoir.`}
        </p>
      )}
      <div className="mb-4" />

      <div className="kanban-board">
        {STATUTS.map((statut) => {
          const cartes = etapes.filter((e) => e.statut === statut);
          const accepte = colonneAutorisee(statut);
          return (
            <div
              key={statut}
              className={`kanban-column${overColumn === statut ? " is-dragover" : ""}`}
              onDragOver={(e) => {
                if (!accepte) return;
                e.preventDefault();
                setOverColumn(statut);
              }}
              onDragLeave={() => setOverColumn((c) => (c === statut ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverColumn(null);
                if (!accepte) return;
                const etapeId = e.dataTransfer.getData("text/plain");
                if (etapeId) deplacer(etapeId, statut);
              }}
            >
              <div className="kanban-column-title" style={{ color: ETAPE_STATUT_COLORS[statut] }}>
                <span aria-hidden="true">●</span> {ETAPE_STATUT_LABELS[statut]} ({cartes.length})
              </div>

              {cartes.map((etape) => {
                const nbMessages = messagesParEtape[etape.id]?.length ?? 0;
                const nbDocs = documentsParEtape[etape.id] ?? 0;
                const deplacable =
                  peutEditer && (peutValider || (statut !== "validee" && statut !== "refusee"));
                const retard =
                  etape.date_echeance &&
                  etape.statut !== "validee" &&
                  new Date(etape.date_echeance) < new Date(new Date().toDateString());

                return (
                  <article
                    key={etape.id}
                    className={`kanban-card${draggingId === etape.id ? " is-dragging" : ""}`}
                    draggable={deplacable}
                    onDragStart={(e) => {
                      setDraggingId(etape.id);
                      e.dataTransfer.setData("text/plain", etape.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <button
                      type="button"
                      onClick={() => setOuverteId(etape.id)}
                      className="block w-full text-left font-medium hover:underline"
                    >
                      {etape.titre}
                    </button>

                    {etape.description && (
                      <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--color-muted)" }}>
                        {etape.description}
                      </p>
                    )}

                    {etape.date_echeance && (
                      <p
                        className="mt-1 text-xs font-medium"
                        style={{ color: retard ? "var(--color-danger)" : "var(--color-muted)" }}
                      >
                        {retard ? "En retard — " : "Pour le "}
                        {new Date(etape.date_echeance).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    )}

                    <div className="kanban-card-meta">
                      <span>💬 {nbMessages}</span>
                      <span>📎 {nbDocs}</span>
                    </div>
                  </article>
                );
              })}

              {!cartes.length && (
                <p className="px-1 text-xs" style={{ color: "var(--color-muted)" }}>
                  Aucune étape.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {peutEditer && (
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

      {ouverte && (
        <PanneauEtape
          etape={ouverte}
          projetId={projetId}
          messages={messagesParEtape[ouverte.id] ?? []}
          nbDocuments={documentsParEtape[ouverte.id] ?? 0}
          peutEditer={peutEditer}
          peutValider={peutValider}
          onFermer={() => setOuverteId(null)}
        />
      )}
    </section>
  );
}
