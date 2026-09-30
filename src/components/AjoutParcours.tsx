"use client";

import { useState } from "react";
import { ajouterAuParcours } from "@/app/actions-parcours";
import { Feuille } from "@/components/Feuille";
import { useEnvoi } from "@/lib/useEnvoi";
import type { ElementParcours, RdvMode } from "@/lib/types";

export type Interlocuteur = { id: string; prenom: string; nom: string };

const CHOIX: { type: ElementParcours; titre: string; detail: string; fond: string; trait: string; icone: React.ReactNode }[] = [
  {
    type: "etape",
    titre: "Une étape à faire",
    detail: "Une chose à accomplir, avec une date si vous voulez",
    fond: "#eaf1fc",
    trait: "#1e4c96",
    icone: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    type: "rendez_vous",
    titre: "Un rendez-vous",
    detail: "Avec votre accompagnateur ou un partenaire",
    fond: "#fdf1dc",
    trait: "#7a4a00",
    icone: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </>
    ),
  },
  {
    type: "document",
    titre: "Un document à fournir",
    detail: "Une pièce que l'équipe attend de vous, ou l'inverse",
    fond: "#e6f5ee",
    trait: "#16794f",
    icone: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5" />
      </>
    ),
  },
];

const MODES: { valeur: RdvMode; label: string }[] = [
  { valeur: "visio", label: "En visio" },
  { valeur: "telephone", label: "Au téléphone" },
  { valeur: "sur_place", label: "Sur place" },
];

/**
 * « Ajouter » : une étape, un rendez-vous ou un document, dans une seule
 * feuille. D'abord le choix, en trois grosses cartes ; ensuite un formulaire
 * court, en questions simples (« Avec qui ? », « Quel jour ? »).
 *
 * Utilisé tel quel par le porteur et par l'équipe : les deux construisent le
 * même parcours, il n'y a pas de raison que l'un ait un formulaire plus
 * pauvre que l'autre.
 */
export function AjoutParcours({
  projetId,
  interlocuteurs,
  libelle = "+ Ajouter",
  classeBouton = "btn btn-primary",
  prenomAccompagnateur,
}: {
  projetId: string;
  interlocuteurs: Interlocuteur[];
  libelle?: string;
  classeBouton?: string;
  /** Pour la phrase sous le bouton : « César le verra… ». */
  prenomAccompagnateur?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState<ElementParcours | null>(null);

  function fermer() {
    setOuvert(false);
    setType(null);
  }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={classeBouton}>
        {libelle}
      </button>

      {ouvert && !type && (
        <Feuille titre="Que voulez-vous ajouter ?" onFermer={fermer}>
          <ul className="flex flex-col gap-3 pt-2">
            {CHOIX.map((c) => (
              <li key={c.type}>
                <button
                  type="button"
                  onClick={() => setType(c.type)}
                  className="flex w-full items-center gap-4 rounded-2xl border p-4 text-left"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: c.fond, color: c.trait }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {c.icone}
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[17px] font-bold">{c.titre}</span>
                    <span className="block text-[15px]" style={{ color: "var(--color-muted)" }}>
                      {c.detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Feuille>
      )}

      {ouvert && type && (
        <FormulaireAjout
          key={type}
          type={type}
          projetId={projetId}
          interlocuteurs={interlocuteurs}
          prenomAccompagnateur={prenomAccompagnateur}
          onRetour={() => setType(null)}
          onFini={fermer}
        />
      )}
    </>
  );
}

function FormulaireAjout({
  type,
  projetId,
  interlocuteurs,
  prenomAccompagnateur,
  onRetour,
  onFini,
}: {
  type: ElementParcours;
  projetId: string;
  interlocuteurs: Interlocuteur[];
  prenomAccompagnateur?: string;
  onRetour: () => void;
  onFini: () => void;
}) {
  const envoi = useEnvoi(ajouterAuParcours, { vider: false, onSucces: () => onFini() });
  const pending = envoi.pending;
  const [avec, setAvec] = useState<string>(interlocuteurs[0]?.id ?? "");
  const [mode, setMode] = useState<RdvMode>("visio");

  const titres: Record<ElementParcours, string> = {
    etape: "Nouvelle étape",
    rendez_vous: "Nouveau rendez-vous",
    document: "Document à fournir",
  };
  const bouton: Record<ElementParcours, string> = {
    etape: "Ajouter cette étape",
    rendez_vous: "Proposer ce rendez-vous",
    document: "Ajouter ce document",
  };
  const choisi = interlocuteurs.find((i) => i.id === avec);
  const quiVerra = type === "rendez_vous" ? (choisi?.prenom ?? prenomAccompagnateur) : prenomAccompagnateur;

  return (
    <Feuille
      titre={titres[type]}
      onFermer={onFini}
      onRetour={onRetour}
      pied={
        <>
          <button type="submit" form="form-ajout-parcours" disabled={pending} className="btn btn-primary btn-grand w-full">
            {pending ? "Un instant…" : bouton[type]}
          </button>
          {type === "rendez_vous" && (
            <p className="mt-2 text-center text-sm" style={{ color: "var(--color-muted)" }}>
              {quiVerra ? `${quiVerra} le verra` : "L'équipe le verra"} et pourra confirmer ou proposer un autre moment.
            </p>
          )}
        </>
      }
    >
      <form id="form-ajout-parcours" onSubmit={envoi.onSubmit} className="flex flex-col gap-5 pt-2">
        <input type="hidden" name="projet_id" value={projetId} />
        <input type="hidden" name="type" value={type} />

        {type === "rendez_vous" ? (
          <>
            <fieldset>
              <legend className="mb-2 text-[17px] font-bold">Avec qui ?</legend>
              <input type="hidden" name="rdv_avec" value={avec} />
              <div className="flex flex-wrap gap-2">
                {interlocuteurs.map((i) => (
                  <Puce key={i.id} actif={avec === i.id} onClick={() => setAvec(i.id)}>
                    {i.prenom} {i.nom}
                  </Puce>
                ))}
                <Puce actif={avec === ""} onClick={() => setAvec("")}>
                  Toute l&apos;équipe
                </Puce>
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rdv-jour" className="mb-2 block text-[17px] font-bold">
                  Quel jour ?
                </label>
                <input id="rdv-jour" name="rdv_jour" type="date" required className="champ-grand" />
              </div>
              <div>
                <label htmlFor="rdv-heure" className="mb-2 block text-[17px] font-bold">
                  À quelle heure ?
                </label>
                <input id="rdv-heure" name="rdv_heure" type="time" step={900} required defaultValue="14:00" className="champ-grand" />
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-[17px] font-bold">Comment ?</legend>
              <input type="hidden" name="rdv_mode" value={mode} />
              <div className="flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <Puce key={m.valeur} actif={mode === m.valeur} onClick={() => setMode(m.valeur)}>
                    {m.label}
                  </Puce>
                ))}
              </div>
              <label htmlFor="rdv-lieu" className="mb-1 mt-3 block text-[15px]" style={{ color: "var(--color-muted)" }}>
                {mode === "sur_place" ? "Adresse" : mode === "telephone" ? "Numéro à appeler" : "Lien de la visio"} (facultatif)
              </label>
              <input id="rdv-lieu" name="rdv_lieu" className="champ-grand" />
            </fieldset>

            <div>
              <label htmlFor="rdv-objet" className="mb-2 block text-[17px] font-bold">
                De quoi voulez-vous parler ?
              </label>
              <textarea id="rdv-objet" name="description" rows={3} className="champ-grand" placeholder="En quelques mots" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="ajout-titre" className="mb-2 block text-[17px] font-bold">
                {type === "document" ? "Quel document ?" : "Qu'y a-t-il à faire ?"}
              </label>
              <input
                id="ajout-titre"
                name="titre"
                required
                minLength={2}
                maxLength={200}
                className="champ-grand"
                placeholder={type === "document" ? "Ex. : Statuts de la société" : "Ex. : Rencontrer deux acheteurs suisses"}
              />
            </div>
            <div>
              <label htmlFor="ajout-date" className="mb-2 block text-[17px] font-bold">
                Pour quand ? <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
              </label>
              <input id="ajout-date" name="date_echeance" type="date" className="champ-grand" />
            </div>
            <div>
              <label htmlFor="ajout-detail" className="mb-2 block text-[17px] font-bold">
                Des précisions ? <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
              </label>
              <textarea id="ajout-detail" name="description" rows={3} className="champ-grand" />
            </div>
          </>
        )}

        {envoi.erreur && (
          <p role="alert" className="text-[15px] font-semibold" style={{ color: "var(--color-danger)" }}>
            {envoi.erreur}
          </p>
        )}
      </form>
    </Feuille>
  );
}

export function Puce({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className="rounded-full border-2 px-4 text-[16px]"
      style={{
        minHeight: 48,
        borderColor: actif ? "var(--color-primary)" : "var(--color-border)",
        background: actif ? "var(--color-primary-soft)" : "var(--color-surface)",
        color: actif ? "var(--color-primary)" : "var(--color-text)",
        fontWeight: actif ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}
