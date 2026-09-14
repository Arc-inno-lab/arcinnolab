"use client";

import { useState } from "react";
import { useActionState } from "react";
import { creerPromotion } from "@/app/actions";
import { FieldError } from "@/components/FieldError";

const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

/**
 * Création d'une promotion, réservée à l'Admin (la RLS le vérifie aussi).
 * Sans promotion ouverte, la voie « accompagnement » est inutilisable : il n'y
 * a nulle part où verser une candidature en attente du comité.
 */
export function NouvellePromotion() {
  const [ouvert, setOuvert] = useState(false);
  const [state, action, pending] = useActionState(creerPromotion, {});

  if (state.success && ouvert) {
    return (
      <div className="card mb-5 p-4 text-sm" role="status">
        Promotion créée. Les demandes peuvent désormais y être versées.
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="btn btn-outline mb-5">
        + Nouvelle promotion
      </button>
    );
  }

  const anneeProchaine = new Date().getFullYear() + 1;

  return (
    <form action={action} className="card mb-5 p-5">
      <h2 className="mb-1 text-lg font-medium">Nouvelle promotion</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        Le comité mixte ne siège qu&apos;une fois par an. Renseigner sa date
        n&apos;est pas cosmétique : c&apos;est la seule information qui permet de
        dire à un porteur combien de temps il devra attendre.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="nom" className="mb-1 block text-sm font-medium">
            Nom
          </label>
          <input
            id="nom"
            name="nom"
            required
            defaultValue={`Promotion ${anneeProchaine}`}
            className={champ}
            style={bordure}
          />
        </div>
        <div>
          <label htmlFor="date_comite" className="mb-1 block text-sm font-medium">
            Date du comité
          </label>
          <input id="date_comite" name="date_comite" type="date" className={champ} style={bordure} />
        </div>
      </div>

      <FieldError message={state.error} />

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "…" : "Créer"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="btn btn-outline">
          Annuler
        </button>
      </div>
    </form>
  );
}
