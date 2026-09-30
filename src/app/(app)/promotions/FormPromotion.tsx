"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enregistrerPromotion } from "@/app/actions-promotions";
import { FieldError } from "@/components/FieldError";
import { Tiroir } from "@/components/Tiroir";
import { useEnvoi } from "@/lib/useEnvoi";
import type { Promotion } from "@/lib/types";

const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

/** Bouton + panneau de création ou de modification d'une promotion. */
export function FormPromotion({ promotion, libelle, classe = "btn btn-primary" }: { promotion?: Promotion; libelle: string; classe?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={classe}>
        {libelle}
      </button>
      {ouvert && (
        <Tiroir
          titre={promotion ? `Modifier ${promotion.nom}` : "Nouvelle promotion"}
          sousTitre="Une promotion, c'est une cohorte de projets accompagnés, sélectionnée par le vote des partenaires."
          onFermer={() => setOuvert(false)}
        >
          <Formulaire
            promotion={promotion}
            onFini={(id) => {
              setOuvert(false);
              if (!promotion && id) router.push(`/promotions/${id}`);
            }}
          />
        </Tiroir>
      )}
    </>
  );
}

function Formulaire({ promotion, onFini }: { promotion?: Promotion; onFini: (id?: string) => void }) {
  const envoi = useEnvoi(enregistrerPromotion, { vider: false, onSucces: (_f, _fd, r) => onFini(r.id) });

  return (
    <form onSubmit={envoi.onSubmit} className="flex flex-col gap-4">
      {promotion && <input type="hidden" name="id" value={promotion.id} />}
      <div>
        <label htmlFor="promo-nom" className="mb-1 block text-sm font-medium">
          Nom
        </label>
        <input id="promo-nom" name="nom" required defaultValue={promotion?.nom ?? ""} placeholder="Promotion 2027" className={champ} style={bordure} />
      </div>
      <div>
        <label htmlFor="promo-description" className="mb-1 block text-sm font-medium">
          Description <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
        </label>
        <textarea id="promo-description" name="description" rows={3} defaultValue={promotion?.description ?? ""} placeholder="Thème, public visé, ce que la promotion apporte…" className={champ} style={bordure} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="promo-comite" className="mb-1 block text-sm font-medium">
            Comité de sélection
          </label>
          <input id="promo-comite" name="date_comite" type="date" defaultValue={promotion?.date_comite ?? ""} className={champ} style={bordure} />
        </div>
        <div>
          <label htmlFor="promo-places" className="mb-1 block text-sm font-medium">
            Places
          </label>
          <input id="promo-places" name="places" type="number" min={1} max={500} defaultValue={promotion?.places ?? ""} className={champ} style={bordure} />
        </div>
        <div>
          <label htmlFor="promo-debut" className="mb-1 block text-sm font-medium">
            Début de l&apos;accompagnement
          </label>
          <input id="promo-debut" name="date_debut" type="date" defaultValue={promotion?.date_debut ?? ""} className={champ} style={bordure} />
        </div>
        <div>
          <label htmlFor="promo-fin" className="mb-1 block text-sm font-medium">
            Fin de l&apos;accompagnement
          </label>
          <input id="promo-fin" name="date_fin" type="date" defaultValue={promotion?.date_fin ?? ""} className={champ} style={bordure} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="ouverte" defaultChecked={promotion ? promotion.ouverte : true} style={{ width: 18, height: 18, minHeight: 0 }} />
        Ouverte aux candidatures (on peut y mettre des projets au vote)
      </label>
      <FieldError message={envoi.erreur} />
      <div>
        <button type="submit" disabled={envoi.pending} className="btn btn-primary">
          {envoi.pending ? "Enregistrement…" : promotion ? "Enregistrer" : "Créer la promotion"}
        </button>
      </div>
    </form>
  );
}
