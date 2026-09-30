"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import {
  ajouterColonne,
  ajouterEtapeRapide,
  decalerColonne,
  deplacerEtape,
  renommerColonne,
  repondreRendezVous,
  supprimerColonne,
  trancherEtape,
} from "@/app/actions-parcours";
import { AjoutParcours, type Interlocuteur } from "@/components/AjoutParcours";
import { aujourdhuiIso, estEnRetard, heure, jourCourt, lireParcours } from "@/lib/parcours";
import type { ColonneProjet, EtapeProjet, MessageProjet, RdvMode } from "@/lib/types";
import { PanneauEtape } from "./PanneauEtape";

const MODE_COURT: Record<RdvMode, string> = { visio: "visio", telephone: "téléphone", sur_place: "sur place" };

/**
 * Le passeport du projet, vu par l'équipe : un tableau dont les colonnes
 * appartiennent au projet (on les nomme, on les ajoute, on les range).
 *
 * Deux informations distinctes sur chaque carte :
 * - la colonne dit où en est le travail, et tout le monde peut l'y déplacer ;
 * - la pastille dit ce qu'en pense le référent (à valider, validée, à
 *   reprendre), et lui seul la change. Déposer une étape dans la dernière
 *   colonne la lui soumet ; la base le garantit (migration 018).
 */
export function KanbanEtapes({
  projetId,
  etapes,
  colonnes,
  instant,
  moi,
  noms,
  interlocuteurs,
  peutEditer,
  peutValider,
  messagesParEtape,
  documentsParEtape,
}: {
  projetId: string;
  etapes: EtapeProjet[];
  colonnes: ColonneProjet[];
  /** L'instant du chargement, pour que serveur et navigateur voient les mêmes retards. */
  instant: number;
  moi: string;
  noms: Record<string, string>;
  interlocuteurs: Interlocuteur[];
  peutEditer: boolean;
  peutValider: boolean;
  messagesParEtape: Record<string, MessageProjet[]>;
  documentsParEtape: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [vues, deplacerVue] = useOptimistic(
    etapes,
    (etat, geste: { id: string; colonne: string }) =>
      etat.map((e) => (e.id === geste.id ? { ...e, colonne_id: geste.colonne } : e))
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [ouverteId, setOuverteId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [nouvelleColonne, setNouvelleColonne] = useState(false);

  const lecture = lireParcours(vues, colonnes, instant);
  const aujourdhui = aujourdhuiIso(instant);
  const pct = lecture.total ? Math.round((lecture.validees / lecture.total) * 100) : 0;
  const premiere = colonnes.find((c) => !c.terminale)?.id ?? colonnes[0]?.id ?? null;
  const ouverte = vues.find((e) => e.id === ouverteId) ?? null;

  function colonneDe(e: EtapeProjet) {
    return e.colonne_id && colonnes.some((c) => c.id === e.colonne_id) ? e.colonne_id : premiere;
  }

  // Un rendez-vous se confirme par « l'autre côté » : l'équipe répond au
  // porteur, pas à un collègue. Les interlocuteurs sont les porteurs du projet.
  const idsPorteurs = new Set(interlocuteurs.map((i) => i.id));
  function proposeParLePorteur(e: EtapeProjet) {
    return !!e.cree_par && idsPorteurs.has(e.cree_par);
  }

  function deplacable(e: EtapeProjet) {
    return peutEditer && (peutValider || e.validation !== "validee");
  }

  function deplacer(etapeId: string, colonneId: string) {
    const e = vues.find((x) => x.id === etapeId);
    if (!e || colonneDe(e) === colonneId || !deplacable(e)) return;
    setErreur(undefined);
    startTransition(async () => {
      deplacerVue({ id: etapeId, colonne: colonneId });
      const r = await deplacerEtape(projetId, etapeId, colonneId);
      if (r.error) setErreur("Déplacement refusé : " + r.error);
    });
  }

  function trancher(etapeId: string, decision: "validee" | "refusee") {
    setErreur(undefined);
    startTransition(async () => {
      const r = await trancherEtape(projetId, etapeId, decision);
      if (r.error) setErreur(r.error);
    });
  }

  function repondre(etapeId: string, reponse: "confirme" | "annule") {
    startTransition(async () => {
      const r = await repondreRendezVous(projetId, etapeId, reponse);
      if (r.error) setErreur(r.error);
    });
  }

  return (
    <section aria-labelledby="etapes-heading" className="card p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="etapes-heading" className="text-lg font-semibold">
            Passeport du projet
          </h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Colonnes et étapes propres à ce projet. Seul le référent valide une étape.
          </p>
        </div>
        {peutEditer && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setNouvelleColonne(true)} className="btn btn-outline">
              + Colonne
            </button>
            <AjoutParcours projetId={projetId} interlocuteurs={interlocuteurs} />
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <div
          className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full"
          style={{ background: "#eef1f6" }}
          role="img"
          aria-label={`Avancement : ${pct} %`}
        >
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-success)" }} />
        </div>
        <span className="text-sm font-semibold">
          {lecture.total ? `${lecture.validees} validée${lecture.validees > 1 ? "s" : ""} sur ${lecture.total}` : "Aucune étape pour l'instant"}
        </span>
        {lecture.aValider > 0 && <span className="text-sm font-semibold">{lecture.aValider} à valider</span>}
        {lecture.enRetard > 0 && (
          <span className="text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
            {lecture.enRetard} en retard
          </span>
        )}
      </div>

      {erreur && (
        <p role="alert" className="mb-3 rounded-md px-3 py-2 text-sm" style={{ background: "var(--color-accent-soft)", color: "var(--color-danger)" }}>
          {erreur}
        </p>
      )}

      <div className="kanban-board">
        {colonnes.map((col, index) => {
          const cartes = vues
            .filter((e) => colonneDe(e) === col.id)
            .sort((a, b) => a.ordre - b.ordre);
          const travail = colonnes.filter((c) => !c.terminale);
          const rangTravail = travail.findIndex((c) => c.id === col.id);
          return (
            <div
              key={col.id}
              className={`kanban-column${survol === col.id ? " is-dragover" : ""}`}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                setSurvol(col.id);
              }}
              onDragLeave={() => setSurvol((c) => (c === col.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setSurvol(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) deplacer(id, col.id);
              }}
            >
              <EnteteColonne
                projetId={projetId}
                colonne={col}
                nombre={cartes.length}
                peutEditer={peutEditer}
                peutGauche={!col.terminale && rangTravail > 0}
                peutDroite={!col.terminale && rangTravail < travail.length - 1}
                supprimable={!col.terminale && travail.length > 1}
                onErreur={setErreur}
                key={`${col.id}-${col.nom}-${index}`}
              />

              {cartes.map((etape) => (
                <Carte
                  key={etape.id}
                  etape={etape}
                  terminale={col.terminale}
                  retard={estEnRetard(etape, lecture.terminales, aujourdhui)}
                  nbMessages={messagesParEtape[etape.id]?.length ?? 0}
                  nbDocuments={documentsParEtape[etape.id] ?? 0}
                  proposePar={etape.cree_par ? (etape.cree_par === moi ? "vous" : (noms[etape.cree_par] ?? null)) : null}
                  deplacable={deplacable(etape)}
                  enGlisse={draggingId === etape.id}
                  peutValider={peutValider}
                  peutRepondre={peutEditer && etape.rdv_statut === "propose" && proposeParLePorteur(etape)}
                  pending={pending}
                  onOuvrir={() => setOuverteId(etape.id)}
                  onGlisse={setDraggingId}
                  onTrancher={trancher}
                  onRepondre={repondre}
                />
              ))}

              {!col.terminale && peutEditer && <AjoutRapide projetId={projetId} colonneId={col.id} onErreur={setErreur} />}
              {col.terminale && !cartes.length && (
                <p className="px-1 text-xs" style={{ color: "var(--color-muted)" }}>
                  Glissez ici une étape terminée : le référent la validera.
                </p>
              )}
            </div>
          );
        })}

        {nouvelleColonne && (
          <NouvelleColonne projetId={projetId} onFini={() => setNouvelleColonne(false)} onErreur={setErreur} />
        )}
      </div>

      {ouverte && (
        <PanneauEtape
          key={ouverte.id}
          etape={ouverte}
          projetId={projetId}
          colonnes={colonnes}
          messages={messagesParEtape[ouverte.id] ?? []}
          nbDocuments={documentsParEtape[ouverte.id] ?? 0}
          noms={noms}
          moi={moi}
          proposeParLePorteur={proposeParLePorteur(ouverte)}
          peutEditer={peutEditer}
          peutValider={peutValider}
          enRetard={estEnRetard(ouverte, lecture.terminales, aujourdhui)}
          onFermer={() => setOuverteId(null)}
        />
      )}
    </section>
  );
}

function Carte({
  etape,
  terminale,
  retard,
  nbMessages,
  nbDocuments,
  proposePar,
  deplacable,
  enGlisse,
  peutValider,
  peutRepondre,
  pending,
  onOuvrir,
  onGlisse,
  onTrancher,
  onRepondre,
}: {
  etape: EtapeProjet;
  terminale: boolean;
  retard: boolean;
  nbMessages: number;
  nbDocuments: number;
  proposePar: string | null;
  deplacable: boolean;
  enGlisse: boolean;
  peutValider: boolean;
  peutRepondre: boolean;
  pending: boolean;
  onOuvrir: () => void;
  onGlisse: (id: string | null) => void;
  onTrancher: (id: string, d: "validee" | "refusee") => void;
  onRepondre: (id: string, r: "confirme" | "annule") => void;
}) {
  const rdv = etape.type === "rendez_vous";
  const aValider = etape.validation === "a_valider";
  const bordure = retard
    ? "var(--color-danger)"
    : aValider && peutValider
      ? "var(--color-primary)"
      : "var(--color-border)";

  return (
    <article
      className={`kanban-card${enGlisse ? " is-dragging" : ""}`}
      style={{ borderColor: bordure, cursor: deplacable ? "grab" : "default", opacity: etape.rdv_statut === "annule" ? 0.6 : undefined }}
      draggable={deplacable}
      onDragStart={(e) => {
        onGlisse(etape.id);
        e.dataTransfer.setData("text/plain", etape.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => onGlisse(null)}
    >
      {rdv && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold" style={{ color: "#7a4a00" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M4 10h16M9 3v4M15 3v4" />
          </svg>
          Rendez-vous
        </p>
      )}
      {etape.type === "document" && (
        <p className="mb-1 text-xs font-bold" style={{ color: "var(--color-success)" }}>
          Document à fournir
        </p>
      )}

      <button type="button" onClick={onOuvrir} className="block w-full text-left text-sm font-semibold hover:underline" style={{ minHeight: 0 }}>
        {etape.titre}
      </button>

      {rdv && etape.rdv_debut ? (
        <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
          {jourCourt(etape.rdv_debut)}, {heure(etape.rdv_debut)}
          {etape.rdv_mode ? ` · ${MODE_COURT[etape.rdv_mode]}` : ""}
          {etape.rdv_statut === "confirme"
            ? " · confirmé"
            : etape.rdv_statut === "annule"
              ? " · annulé"
              : proposePar
                ? ` · proposé par ${proposePar}`
                : " · à confirmer"}
        </p>
      ) : etape.date_echeance ? (
        <p className="mt-1 text-xs font-semibold" style={{ color: retard ? "var(--color-danger)" : "var(--color-muted)", fontWeight: retard ? 700 : 400 }}>
          {retard ? "En retard · prévu le " : "Pour le "}
          {jourCourt(etape.date_echeance)}
        </p>
      ) : !terminale && !rdv ? (
        <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
          Pas de date
        </p>
      ) : null}

      {!rdv && etape.validation && (
        <p className="mt-2">
          {etape.validation === "validee" ? (
            <span className="pastille" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
              ✓ Validée
            </span>
          ) : etape.validation === "a_valider" ? (
            <span className="pastille" style={{ background: "#e9edf4", color: "#3b4452" }}>
              À valider
            </span>
          ) : (
            <span className="pastille" style={{ background: "var(--color-accent-soft)", color: "var(--color-danger)" }}>
              À reprendre
            </span>
          )}
        </p>
      )}

      {!rdv && aValider && peutValider && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onTrancher(etape.id, "validee")}
            className="btn text-xs"
            style={{ background: "var(--color-success)", color: "#fff", minHeight: 36, padding: "0.35rem 0.75rem" }}
          >
            Valider
          </button>
          <button type="button" disabled={pending} onClick={onOuvrir} className="btn btn-outline text-xs" style={{ minHeight: 36, padding: "0.35rem 0.75rem" }}>
            Refuser…
          </button>
        </div>
      )}

      {rdv && peutRepondre && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onRepondre(etape.id, "confirme")}
            className="btn btn-primary text-xs"
            style={{ minHeight: 36, padding: "0.35rem 0.75rem" }}
          >
            Confirmer
          </button>
          <button type="button" onClick={onOuvrir} className="btn btn-outline text-xs" style={{ minHeight: 36, padding: "0.35rem 0.75rem" }}>
            Autre date
          </button>
        </div>
      )}

      {(nbMessages > 0 || nbDocuments > 0) && (
        <div className="kanban-card-meta">
          {nbMessages > 0 && <span>{nbMessages} message{nbMessages > 1 ? "s" : ""}</span>}
          {nbDocuments > 0 && <span>{nbDocuments} pièce{nbDocuments > 1 ? "s" : ""}</span>}
        </div>
      )}
    </article>
  );
}

/** Le titre d'une colonne et son menu « ··· » : renommer, déplacer, supprimer. */
function EnteteColonne({
  projetId,
  colonne,
  nombre,
  peutEditer,
  peutGauche,
  peutDroite,
  supprimable,
  onErreur,
}: {
  projetId: string;
  colonne: ColonneProjet;
  nombre: number;
  peutEditer: boolean;
  peutGauche: boolean;
  peutDroite: boolean;
  supprimable: boolean;
  onErreur: (m: string | undefined) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [edition, setEdition] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [pending, startTransition] = useTransition();
  const nomRef = useRef<HTMLInputElement>(null);

  function agir(f: () => Promise<{ error?: string }>) {
    onErreur(undefined);
    setMenu(false);
    setConfirmer(false);
    startTransition(async () => {
      const r = await f();
      if (r.error) onErreur(r.error);
    });
  }

  if (edition) {
    return (
      <form
        className="mb-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const nom = nomRef.current?.value ?? "";
          setEdition(false);
          if (nom.trim() && nom.trim() !== colonne.nom) agir(() => renommerColonne(projetId, colonne.id, nom));
        }}
      >
        <label htmlFor={`nom-${colonne.id}`} className="sr-only">
          Nom de la colonne
        </label>
        <input
          id={`nom-${colonne.id}`}
          ref={nomRef}
          defaultValue={colonne.nom}
          maxLength={60}
          autoFocus
          className="min-w-0 flex-1 rounded-md border px-2 text-sm"
          style={{ borderColor: "var(--color-border)", minHeight: 36 }}
        />
        <button type="submit" className="btn btn-primary text-xs" style={{ minHeight: 36, padding: "0.25rem 0.6rem" }}>
          OK
        </button>
      </form>
    );
  }

  return (
    <div className="relative mb-2 flex items-center justify-between gap-2 px-1">
      <h3 className="text-sm font-bold">
        {colonne.nom}{" "}
        <span className="font-normal" style={{ color: "var(--color-muted)" }}>
          {nombre}
        </span>
      </h3>
      {peutEditer && (
        <button
          type="button"
          aria-label={`Options de la colonne ${colonne.nom}`}
          aria-expanded={menu}
          disabled={pending}
          onClick={() => {
            setMenu((m) => !m);
            setConfirmer(false);
          }}
          className="rounded-md px-2 text-base font-bold leading-none"
          style={{ minHeight: 32, color: "var(--color-muted)" }}
        >
          ···
        </button>
      )}
      {menu && (
        <ul
          className="absolute right-0 top-8 z-20 flex w-52 flex-col rounded-lg border py-1 text-sm shadow-lg"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <li>
            <button type="button" className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg)]" style={{ minHeight: 0 }} onClick={() => { setMenu(false); setEdition(true); }}>
              Renommer
            </button>
          </li>
          {peutGauche && (
            <li>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg)]" style={{ minHeight: 0 }} onClick={() => agir(() => decalerColonne(projetId, colonne.id, -1))}>
                ← Déplacer à gauche
              </button>
            </li>
          )}
          {peutDroite && (
            <li>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg)]" style={{ minHeight: 0 }} onClick={() => agir(() => decalerColonne(projetId, colonne.id, 1))}>
                Déplacer à droite →
              </button>
            </li>
          )}
          {colonne.terminale ? (
            <li className="px-3 py-2 text-xs" style={{ color: "var(--color-muted)" }}>
              Dernière colonne : y déposer une étape la soumet au référent. Elle ne se supprime pas.
            </li>
          ) : !supprimable ? (
            <li className="px-3 py-2 text-xs" style={{ color: "var(--color-muted)" }}>
              Seule colonne de travail : elle ne se supprime pas.
            </li>
          ) : (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-[var(--color-bg)]"
                style={{ minHeight: 0, color: "var(--color-danger)", fontWeight: confirmer ? 700 : 400 }}
                onClick={() => (confirmer ? agir(() => supprimerColonne(projetId, colonne.id)) : setConfirmer(true))}
              >
                {confirmer ? (nombre ? `Supprimer (${nombre} étape${nombre > 1 ? "s" : ""} déplacée${nombre > 1 ? "s" : ""})` : "Confirmer la suppression") : "Supprimer la colonne"}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function AjoutRapide({
  projetId,
  colonneId,
  onErreur,
}: {
  projetId: string;
  colonneId: string;
  onErreur: (m: string | undefined) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="w-full rounded-md px-2 py-1.5 text-left text-sm"
        style={{ color: "var(--color-muted)", minHeight: 36 }}
      >
        + Ajouter une étape
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const champ = ref.current;
        const titre = champ?.value ?? "";
        if (!titre.trim()) return;
        onErreur(undefined);
        startTransition(async () => {
          const r = await ajouterEtapeRapide(projetId, colonneId, titre);
          if (r.error) onErreur(r.error);
          else if (champ) champ.value = "";
        });
      }}
    >
      <label htmlFor={`rapide-${colonneId}`} className="sr-only">
        Titre de la nouvelle étape
      </label>
      <input
        id={`rapide-${colonneId}`}
        ref={ref}
        autoFocus
        placeholder="Titre de l'étape, puis Entrée"
        onBlur={(e) => {
          if (!e.currentTarget.value.trim()) setOuvert(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOuvert(false);
        }}
        disabled={pending}
        className="w-full rounded-md border px-2 text-sm"
        style={{ borderColor: "var(--color-border)", minHeight: 38 }}
      />
    </form>
  );
}

function NouvelleColonne({
  projetId,
  onFini,
  onErreur,
}: {
  projetId: string;
  onFini: () => void;
  onErreur: (m: string | undefined) => void;
}) {
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      className="kanban-column"
      onSubmit={(e) => {
        e.preventDefault();
        const nom = ref.current?.value ?? "";
        if (!nom.trim()) return onFini();
        startTransition(async () => {
          const r = await ajouterColonne(projetId, nom);
          if (r.error) onErreur(r.error);
          onFini();
        });
      }}
    >
      <label htmlFor="nouvelle-colonne" className="mb-2 block px-1 text-sm font-bold">
        Nouvelle colonne
      </label>
      <input
        id="nouvelle-colonne"
        ref={ref}
        autoFocus
        maxLength={60}
        placeholder="Ex. : En attente du client"
        onKeyDown={(e) => {
          if (e.key === "Escape") onFini();
        }}
        className="w-full rounded-md border px-2 text-sm"
        style={{ borderColor: "var(--color-border)", minHeight: 38 }}
      />
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary text-xs" style={{ minHeight: 36 }}>
          Créer
        </button>
        <button type="button" onClick={onFini} className="btn btn-outline text-xs" style={{ minHeight: 36 }}>
          Annuler
        </button>
      </div>
    </form>
  );
}
