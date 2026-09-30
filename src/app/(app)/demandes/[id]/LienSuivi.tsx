"use client";

import { useState } from "react";

/** Le lien personnel du porteur : à lui renvoyer s'il l'a perdu, ou pour voir ce qu'il voit. */
export function LienSuivi({ lien, prenom }: { lien: string; prenom: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Sa page de suivi</h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Ce que {prenom} voit : l&apos;étape en cours, ce qu&apos;il a à faire, vos messages.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copier} className="btn btn-outline">
          {copie ? "Lien copié" : "Copier le lien"}
        </button>
        <a href={lien} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
          Voir comme {prenom}
        </a>
      </div>
    </section>
  );
}
