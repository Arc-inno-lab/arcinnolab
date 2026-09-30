"use client";

import { useState } from "react";

/**
 * Le lien public de dépôt, toujours sous la main : à coller dans un e-mail,
 * sur un site partenaire, dans une plaquette. Un porteur n'a besoin que de
 * lui pour se manifester.
 */
export function LienDepot({ lien }: { lien: string }) {
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
    <section className="card flex max-w-full flex-wrap items-center gap-3 px-4 py-3" aria-label="Lien de dépôt des nouveaux projets">
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: "var(--color-muted)" }}>
          Lien de dépôt des nouveaux projets
        </p>
        <p className="truncate text-sm font-medium" style={{ maxWidth: "22rem" }}>
          {lien.replace(/^https?:\/\//, "")}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={copier} className="btn btn-primary text-xs" style={{ minHeight: 36 }}>
          {copie ? "Lien copié" : "Copier"}
        </button>
        <a href={lien} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-xs" style={{ minHeight: 36 }}>
          Ouvrir
        </a>
      </div>
    </section>
  );
}
