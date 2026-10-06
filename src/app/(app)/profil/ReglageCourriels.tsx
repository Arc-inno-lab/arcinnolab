"use client";

import { useState } from "react";
import { changerCourriels } from "@/app/actions";
import { useEnvoi } from "@/lib/useEnvoi";

/** Recevoir ou non les e-mails de notification. Enregistré dès le clic. */
export function ReglageCourriels({ actifs, porteur }: { actifs: boolean; porteur: boolean }) {
  const [coche, setCoche] = useState(actifs);
  const envoi = useEnvoi(changerCourriels, { vider: false });

  return (
    <form onSubmit={envoi.onSubmit} className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">E-mails</h2>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="courriels_actifs"
          checked={coche}
          onChange={(e) => {
            setCoche(e.target.checked);
            e.currentTarget.form?.requestSubmit();
          }}
          style={{ width: 20, height: 20, minHeight: 0, marginTop: 1 }}
        />
        <span>
          <strong>Me prévenir par e-mail</strong>
          <br />
          <span style={{ color: "var(--color-muted)" }}>
            {porteur
              ? "Un e-mail quand votre accompagnateur vous écrit ou vous propose un rendez-vous, et un récap le matin s'il y a du nouveau."
              : "Tout de suite pour ce qui appelle une réponse (nouvelle demande, message d'un porteur, mention, avis attendu) ; le reste dans un récap le matin, du lundi au vendredi."}
          </span>
        </span>
      </label>
      {envoi.pending && <p className="text-xs" style={{ color: "var(--color-muted)" }}>Enregistrement…</p>}
      {envoi.succes && !envoi.pending && (
        <p role="status" className="text-xs font-semibold" style={{ color: "var(--color-success)" }}>
          {coche ? "E-mails activés." : "E-mails coupés : les notifications restent visibles dans l'appli."}
        </p>
      )}
      {envoi.erreur && (
        <p role="alert" className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
          {envoi.erreur}
        </p>
      )}
    </form>
  );
}
