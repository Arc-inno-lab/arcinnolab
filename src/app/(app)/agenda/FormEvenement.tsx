"use client";

import { useState } from "react";
import { changerEtatEvenement, enregistrerEvenement } from "@/app/actions-agenda";
import { FieldError } from "@/components/FieldError";
import { Tiroir } from "@/components/Tiroir";
import { useEnvoi } from "@/lib/useEnvoi";
import type { Evenement } from "@/lib/types";

const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

/** Valeurs de formulaire déjà converties à l'heure de Paris par le serveur. */
export type ChampsEvenement = { jour: string; heureDebut: string; jourFin: string; heureFin: string };

/** Bouton + panneau de création ou de modification d'un événement. */
export function FormEvenement({
  evenement,
  champs,
  libelle,
  classe = "btn btn-primary",
}: {
  evenement?: Evenement;
  champs?: ChampsEvenement;
  libelle: string;
  classe?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={classe} style={classe.includes("text-sm") ? { minHeight: 38 } : undefined}>
        {libelle}
      </button>
      {ouvert && (
        <Tiroir
          titre={evenement ? "Modifier l'événement" : "Nouvel événement"}
          sousTitre="Atelier, challenge, conférence, permanence… Visible par tous les membres, et sur la vitrine s'il est public."
          onFermer={() => setOuvert(false)}
        >
          <Formulaire evenement={evenement} champs={champs} onFini={() => setOuvert(false)} />
        </Tiroir>
      )}
    </>
  );
}

function Formulaire({ evenement: e, champs, onFini }: { evenement?: Evenement; champs?: ChampsEvenement; onFini: () => void }) {
  const envoi = useEnvoi(enregistrerEvenement, { vider: false, onSucces: () => onFini() });
  const [plusieursJours, setPlusieursJours] = useState(!!champs?.jourFin && champs.jourFin !== champs.jour);

  return (
    <form onSubmit={envoi.onSubmit} className="flex flex-col gap-4">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div>
        <label htmlFor="ev-titre" className="mb-1 block text-sm font-medium">
          Titre
        </label>
        <input id="ev-titre" name="titre" required minLength={3} maxLength={160} defaultValue={e?.titre ?? ""} placeholder="Atelier prototypage au Crunchlab" className={champ} style={bordure} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ev-jour" className="mb-1 block text-sm font-medium">
            Date
          </label>
          <input id="ev-jour" name="jour" type="date" required defaultValue={champs?.jour ?? ""} className={champ} style={bordure} />
        </div>
        <div>
          <label htmlFor="ev-debut" className="mb-1 block text-sm font-medium">
            Début
          </label>
          <input id="ev-debut" name="heure_debut" type="time" required defaultValue={champs?.heureDebut ?? ""} className={champ} style={bordure} />
        </div>
        <div>
          <label htmlFor="ev-fin" className="mb-1 block text-sm font-medium">
            Fin <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
          </label>
          <input id="ev-fin" name="heure_fin" type="time" defaultValue={champs?.heureFin ?? ""} className={champ} style={bordure} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={plusieursJours} onChange={(ev) => setPlusieursJours(ev.target.checked)} style={{ width: 18, height: 18, minHeight: 0 }} />
        Sur plusieurs jours
      </label>
      {plusieursJours && (
        <div className="sm:w-1/3">
          <label htmlFor="ev-jour-fin" className="mb-1 block text-sm font-medium">
            Jour de fin
          </label>
          <input id="ev-jour-fin" name="jour_fin" type="date" defaultValue={champs?.jourFin ?? ""} className={champ} style={bordure} />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ev-lieu" className="mb-1 block text-sm font-medium">
            Lieu
          </label>
          <input id="ev-lieu" name="lieu" maxLength={200} defaultValue={e?.lieu ?? ""} placeholder="KMØ, Mulhouse · ou « En ligne »" className={champ} style={bordure} />
        </div>
        <div>
          <label htmlFor="ev-orga" className="mb-1 block text-sm font-medium">
            Organisé par
          </label>
          <input id="ev-orga" name="organisateur" maxLength={120} defaultValue={e?.organisateur ?? ""} placeholder="Haute École Arc" className={champ} style={bordure} />
        </div>
      </div>
      <div>
        <label htmlFor="ev-description" className="mb-1 block text-sm font-medium">
          Description <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
        </label>
        <textarea id="ev-description" name="description" rows={4} maxLength={4000} defaultValue={e?.description ?? ""} placeholder="Pour qui, ce qu'on y fait, ce qu'il faut apporter…" className={champ} style={bordure} />
      </div>
      <div>
        <label htmlFor="ev-lien" className="mb-1 block text-sm font-medium">
          Lien <span className="font-normal" style={{ color: "var(--color-muted)" }}>(page de l&apos;événement, visio… facultatif)</span>
        </label>
        <input id="ev-lien" name="lien" type="url" maxLength={500} defaultValue={e?.lien ?? ""} placeholder="https://" className={champ} style={bordure} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="public" defaultChecked={e ? e.public : true} style={{ width: 18, height: 18, minHeight: 0, marginTop: 2 }} />
        <span>
          <strong>Public</strong> : affiché aussi sur la page de dépôt, visible sans compte. Décochez pour le réserver aux membres
          (équipe et porteurs accompagnés).
        </span>
      </label>
      <FieldError message={envoi.erreur} />
      <div>
        <button type="submit" disabled={envoi.pending} className="btn btn-primary">
          {envoi.pending ? "Enregistrement…" : e ? "Enregistrer" : "Publier l'événement"}
        </button>
      </div>
    </form>
  );
}

/** Annuler / rétablir / retirer un événement. Le retrait se confirme d'un second clic. */
export function EtatEvenement({ evenement: e }: { evenement: Evenement }) {
  const envoi = useEnvoi(changerEtatEvenement, { vider: false });
  const [confirmer, setConfirmer] = useState(false);
  const bouton = (geste: string, libelle: string, danger = false) => (
    <form onSubmit={envoi.onSubmit}>
      <input type="hidden" name="id" value={e.id} />
      <input type="hidden" name="geste" value={geste} />
      <button
        type="submit"
        disabled={envoi.pending}
        className="btn btn-outline text-sm"
        style={{ minHeight: 38, ...(danger ? { color: "var(--color-danger)", borderColor: "var(--color-danger)" } : {}) }}
      >
        {libelle}
      </button>
    </form>
  );

  return (
    <>
      {e.annule ? bouton("retablir", "Rétablir") : bouton("annuler", "Annuler l'événement")}
      {confirmer ? (
        <>
          {bouton("retirer", "Confirmer le retrait", true)}
          <button type="button" onClick={() => setConfirmer(false)} className="text-sm underline" style={{ color: "var(--color-muted)" }}>
            garder
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmer(true)} className="text-sm underline" style={{ color: "var(--color-muted)" }}>
          Retirer de l&apos;agenda
        </button>
      )}
      {envoi.erreur && (
        <p role="alert" className="w-full text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
          {envoi.erreur}
        </p>
      )}
    </>
  );
}
