"use client";

import { useState, useTransition } from "react";

type Resultat = { error?: string; success?: boolean; id?: string };

/** Taille maximale d'un document envoyé depuis un formulaire (sous la limite de 4 Mo du serveur). */
export const TAILLE_MAX_DOCUMENT = 3.8 * 1024 * 1024;

/**
 * Envoie un formulaire à une Server Action sans passer par `<form action>`.
 *
 * Avec `<form action>`, React vide le formulaire dès que l'action se termine,
 * même quand elle renvoie une erreur : tout ce que la personne avait écrit est
 * perdu. Ici, le formulaire n'est vidé qu'en cas de succès.
 */
export function useEnvoi(
  action: (prev: Resultat, fd: FormData) => Promise<Resultat>,
  options?: { vider?: boolean; onSucces?: (form: HTMLFormElement, fd: FormData, resultat: Resultat) => void }
) {
  const [pending, startTransition] = useTransition();
  const [resultat, setResultat] = useState<Resultat | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    // Un document trop lourd serait refusé par le serveur avant même
    // d'atteindre l'action, avec une page d'erreur : on prévient avant.
    for (const valeur of fd.values()) {
      if (valeur instanceof File && valeur.size > TAILLE_MAX_DOCUMENT) {
        setResultat({ error: "Ce document dépasse 4 Mo : envoyez une version plus légère." });
        return;
      }
    }
    startTransition(async () => {
      const r = await action({}, fd);
      setResultat(r);
      if (!r.error) {
        if (options?.vider !== false) form.reset();
        options?.onSucces?.(form, fd, r);
      }
    });
  }

  return {
    onSubmit,
    pending,
    erreur: resultat?.error,
    succes: !!resultat && !resultat.error && !!resultat.success,
    effacer: () => setResultat(null),
  };
}
