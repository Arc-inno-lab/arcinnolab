"use client";

import { useState } from "react";
import { enregistrerVitrineProjet } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { useEnvoi } from "@/lib/useEnvoi";

/**
 * Montrer le projet sur la page publique : une décision de l'équipe, avec un
 * résumé écrit pour le public (jamais la description interne). Le bouton
 * « Prendre contact » de la vitrine écrit à ArcInnoLab, pas au porteur.
 */
export function VitrineProjet({
  projetId,
  visible,
  resume,
  lien,
}: {
  projetId: string;
  visible: boolean;
  resume: string | null;
  lien: string | null;
}) {
  const [texte, setTexte] = useState(resume ?? "");
  const envoi = useEnvoi(enregistrerVitrineProjet, { vider: false });

  return (
    <section className="card p-5" aria-labelledby="vitrine-titre">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="vitrine-titre" className="text-base font-semibold">
          Vitrine publique
        </h2>
        <span
          className="pastille"
          style={visible ? { background: "var(--color-success-soft)", color: "var(--color-success)" } : { background: "#e9edf4", color: "#3b4452" }}
        >
          {visible ? "Affiché sur la page d'accueil" : "Non affiché"}
        </span>
      </div>
      <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Pour faire connaître le projet : titre, logo et ce résumé apparaissent sur la page d&apos;accueil publique. Vérifiez
        l&apos;accord du porteur avant de cocher.
      </p>
      <form onSubmit={envoi.onSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="projet_id" value={projetId} />
        <div>
          <label htmlFor="vitrine-resume" className="mb-1 block text-sm font-medium">
            Résumé public <span className="font-normal" style={{ color: "var(--color-muted)" }}>({texte.length}/400)</span>
          </label>
          <textarea
            id="vitrine-resume"
            name="vitrine_resume"
            rows={3}
            maxLength={400}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="En deux ou trois phrases, ce que fait le projet et pour qui."
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
        <div>
          <label htmlFor="vitrine-lien" className="mb-1 block text-sm font-medium">
            Site du projet <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif)</span>
          </label>
          <input
            id="vitrine-lien"
            name="vitrine_lien"
            type="url"
            defaultValue={lien ?? ""}
            placeholder="https://"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="vitrine_visible" defaultChecked={visible} style={{ width: 18, height: 18, minHeight: 0 }} />
          Afficher ce projet sur la page d&apos;accueil publique
        </label>
        <FieldError message={envoi.erreur} />
        {envoi.succes && (
          <p role="status" className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
            Enregistré.
          </p>
        )}
        <div>
          <button type="submit" disabled={envoi.pending} className="btn btn-primary">
            {envoi.pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </section>
  );
}
