"use client";

import { useEffect, useState } from "react";

/**
 * Le bouton « Déposer mon projet » toujours à portée de pouce sur téléphone.
 * Il s'efface quand le haut de page ou le formulaire sont à l'écran : ils
 * ont déjà leurs propres boutons.
 */
export function BoutonMobile() {
  // Caché tant que le haut de page (qui a déjà son bouton) ou le formulaire
  // sont à l'écran.
  const [visibles, setVisibles] = useState<Record<string, boolean>>({ haut: true });
  const cache = Object.values(visibles).some(Boolean);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const cibles = ["haut", "deposer"].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const obs = new IntersectionObserver(
      (entrees) => setVisibles((v) => ({ ...v, ...Object.fromEntries(entrees.map((e) => [e.target.id, e.isIntersecting])) })),
      { threshold: 0.05 }
    );
    cibles.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="vit-cta-mobile md:hidden" data-cache={cache ? "true" : "false"} aria-hidden={cache}>
      <a href="#deposer" className="btn btn-primary btn-grand w-full" tabIndex={cache ? -1 : 0}>
        Déposer mon projet
      </a>
    </div>
  );
}
