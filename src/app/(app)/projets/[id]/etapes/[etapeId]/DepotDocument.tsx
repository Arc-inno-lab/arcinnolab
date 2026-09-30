"use client";

import { useState } from "react";
import { TAILLE_MAX_DOCUMENT } from "@/lib/useEnvoi";

/**
 * Dépôt d'un document sur une étape. La taille est vérifiée avant l'envoi :
 * au-delà de 4 Mo, le serveur refuserait la requête avec une page d'erreur.
 */
export function DepotDocument({ action }: { action: (fd: FormData) => Promise<void> }) {
  const [erreur, setErreur] = useState<string>();

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const f = (e.currentTarget.elements.namedItem("fichier") as HTMLInputElement | null)?.files?.[0];
        if (f && f.size > TAILLE_MAX_DOCUMENT) {
          e.preventDefault();
          setErreur("Ce document dépasse 4 Mo : envoyez une version plus légère.");
        } else {
          setErreur(undefined);
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor="fichier" className="sr-only">
        Ajouter un document
      </label>
      <input id="fichier" type="file" name="fichier" required className="text-sm" />
      <button type="submit" className="btn btn-outline">
        Ajouter le document
      </button>
      {erreur && (
        <p role="alert" className="w-full text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
          {erreur}
        </p>
      )}
    </form>
  );
}
