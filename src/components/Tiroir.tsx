"use client";

import { useEffect } from "react";

/**
 * Un panneau qui s'ouvre sur le côté droit, par-dessus la page.
 *
 * Il sert partout où l'on doit régler quelque chose sans perdre de vue ce que
 * l'on était en train de faire : une étape du passeport, l'invitation d'un
 * porteur, le rattachement d'un partenaire. Une page séparée ferait perdre le
 * contexte au moment précis où l'on en a besoin.
 */
export function Tiroir({
  titre,
  sousTitre,
  onFermer,
  children,
}: {
  titre: string;
  sousTitre?: string;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  // Échap referme : dans un panneau qui recouvre la moitié de l'écran, c'est
  // le réflexe de tout le monde.
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onFermer} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={titre}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l shadow-xl"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <header
          className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{titre}</h2>
            {sousTitre && (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                {sousTitre}
              </p>
            )}
          </div>
          <button type="button" onClick={onFermer} className="btn btn-outline shrink-0 text-xs">
            Fermer
          </button>
        </header>

        <div className="flex flex-col gap-6 px-5 py-5">{children}</div>
      </aside>
    </>
  );
}
