"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { changerEcheance, marquerFaite } from "@/app/actions-parcours";

/**
 * Les trois gestes du porteur sur l'étape du moment. « C'est fait » la
 * soumet à son accompagnateur ; « J'ai besoin d'aide » ouvre la messagerie
 * avec une phrase déjà commencée ; « Changer la date » évite d'avoir à
 * s'excuser d'un retard : on le dit, et on repart.
 */
export function AFaireMaintenant({
  projetId,
  etapeId,
  titre,
  dateEcheance,
}: {
  projetId: string;
  etapeId: string;
  titre: string;
  dateEcheance: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(false);
  const [erreur, setErreur] = useState<string>();

  function lancer(f: () => Promise<{ error?: string }>) {
    setErreur(undefined);
    startTransition(async () => {
      const r = await f();
      if (r.error) setErreur("Cela n'a pas marché : " + r.error);
      else setDate(false);
    });
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <button
          type="button"
          disabled={pending}
          onClick={() => lancer(() => marquerFaite(projetId, etapeId))}
          className="btn btn-primary btn-grand w-full md:w-auto"
        >
          {pending ? "Un instant…" : "C'est fait"}
        </button>
        <Link
          href={`/mon-projet/messages?p=${projetId}&aide=${etapeId}`}
          className="btn btn-outline btn-grand w-full md:w-auto"
          style={{ color: "var(--color-primary)", borderColor: "var(--color-primary)" }}
        >
          J&apos;ai besoin d&apos;aide
        </Link>
        {!date && (
          <button
            type="button"
            onClick={() => setDate(true)}
            className="px-2 text-[16px] underline-offset-4 hover:underline md:no-underline"
            style={{ color: "#3b4452", minHeight: 48 }}
          >
            Changer la date
          </button>
        )}
      </div>

      {date && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const valeur = String(new FormData(e.currentTarget).get("date") || "");
            lancer(() => changerEcheance(projetId, etapeId, valeur));
          }}
        >
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="nouvelle-date" className="mb-1 block text-[15px]" style={{ color: "#3b4452" }}>
              Nouvelle date pour « {titre} »
            </label>
            <input id="nouvelle-date" name="date" type="date" defaultValue={dateEcheance ?? ""} className="champ-grand" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary btn-grand">
            Enregistrer
          </button>
          <button type="button" onClick={() => setDate(false)} className="btn btn-outline btn-grand">
            Annuler
          </button>
        </form>
      )}

      {erreur && (
        <p role="alert" className="mt-2 text-[15px] font-semibold" style={{ color: "var(--color-danger)" }}>
          {erreur}
        </p>
      )}
    </div>
  );
}
