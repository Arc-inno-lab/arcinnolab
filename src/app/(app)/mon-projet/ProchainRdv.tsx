"use client";

import { useState, useTransition } from "react";
import { deplacerRendezVous, repondreRendezVous } from "@/app/actions-parcours";
import { useEnvoi } from "@/lib/useEnvoi";

/**
 * Les réponses possibles à un rendez-vous proposé par l'équipe : « Ça me va »
 * ou « Proposer un autre moment ». Rien d'autre à comprendre.
 */
export function ReponseRdv({ projetId, etapeId }: { projetId: string; etapeId: string }) {
  const [pending, startTransition] = useTransition();
  const [autre, setAutre] = useState(false);
  const autreDate = useEnvoi(deplacerRendezVous, { vider: false });
  const [erreur, setErreur] = useState<string>();

  if (autreDate.succes) {
    return (
      <p className="mt-3 text-[16px] font-semibold" style={{ color: "var(--color-success)" }} role="status">
        C&apos;est envoyé : l&apos;équipe va vous répondre.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {!autre ? (
        <div className="flex flex-col gap-2 md:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await repondreRendezVous(projetId, etapeId, "confirme");
                if (r.error) setErreur(r.error);
              })
            }
            className="btn btn-primary btn-grand w-full md:w-auto"
          >
            Ça me va
          </button>
          <button type="button" onClick={() => setAutre(true)} className="btn btn-outline btn-grand w-full md:w-auto">
            Proposer un autre moment
          </button>
        </div>
      ) : (
        <form onSubmit={autreDate.onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="projet_id" value={projetId} />
          <input type="hidden" name="etape_id" value={etapeId} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rdv-autre-jour" className="mb-1 block text-[16px] font-bold">
                Quel jour ?
              </label>
              <input id="rdv-autre-jour" name="rdv_jour" type="date" required className="champ-grand" />
            </div>
            <div>
              <label htmlFor="rdv-autre-heure" className="mb-1 block text-[16px] font-bold">
                À quelle heure ?
              </label>
              <input id="rdv-autre-heure" name="rdv_heure" type="time" step={900} required defaultValue="14:00" className="champ-grand" />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <button type="submit" disabled={autreDate.pending} className="btn btn-primary btn-grand w-full md:w-auto">
              {autreDate.pending ? "Envoi…" : "Proposer ce moment"}
            </button>
            <button type="button" onClick={() => setAutre(false)} className="btn btn-outline btn-grand w-full md:w-auto">
              Annuler
            </button>
          </div>
        </form>
      )}
      {(erreur || autreDate.erreur) && (
        <p role="alert" className="text-[15px] font-semibold" style={{ color: "var(--color-danger)" }}>
          {erreur || autreDate.erreur}
        </p>
      )}
    </div>
  );
}
