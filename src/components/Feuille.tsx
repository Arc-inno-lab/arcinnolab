"use client";

import { useEffect } from "react";

/**
 * Une feuille qui monte du bas de l'écran sur téléphone, et s'ouvre au centre
 * sur ordinateur.
 *
 * Sur un téléphone, le pouce est en bas : c'est là que doivent arriver les
 * choix. Un panneau latéral, naturel sur un grand écran, oblige ici à viser le
 * haut de l'écran et fait perdre le fil à ceux qui ne vivent pas dans les
 * applications.
 */
export function Feuille({
  titre,
  onFermer,
  onRetour,
  children,
  pied,
}: {
  titre: string;
  onFermer: () => void;
  /** Affiche une flèche de retour à la place de la croix (étape 2 d'un choix). */
  onRetour?: () => void;
  children: React.ReactNode;
  /** Zone collée en bas : le bouton principal reste visible quand on fait défiler. */
  pied?: React.ReactNode;
}) {
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", surTouche);
    // La page derrière ne doit pas défiler pendant qu'on remplit la feuille.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onFermer} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl shadow-xl md:max-w-lg md:rounded-3xl"
        style={{ background: "var(--color-surface)" }}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full md:hidden" style={{ background: "#d5dbe5" }} aria-hidden="true" />
        <header className="flex items-center gap-3 px-5 pb-2 pt-4">
          {onRetour && (
            <button
              type="button"
              onClick={onRetour}
              aria-label="Retour"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ minHeight: 0 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}
          <h2 className="min-w-0 flex-1 text-xl font-bold">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ minHeight: 0 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {pied && (
          <div
            className="border-t px-5 pt-4"
            style={{ borderColor: "var(--color-border)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            {pied}
          </div>
        )}
      </div>
    </div>
  );
}
