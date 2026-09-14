"use client";

import { useActionState } from "react";
import {
  prendreEnCharge,
  qualifierDemande,
  orienterDemande,
  majIssueOrientation,
  verserEnPromotion,
  deciderDemande,
} from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { DemandeAccueil, Orientation, Persona, Promotion } from "@/lib/types";
import {
  PERSONA_LABELS,
  PERSONA_DESCRIPTIONS,
  ORIENTATION_ISSUE_LABELS,
} from "@/lib/types";

const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

export function BoutonPriseEnCharge({ demandeId }: { demandeId: string }) {
  const [state, action, pending] = useActionState(prendreEnCharge, {});
  return (
    <form action={action}>
      <input type="hidden" name="demande_id" value={demandeId} />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "…" : "Je prends en charge"}
      </button>
      <FieldError message={state.error} />
    </form>
  );
}

export function FormQualification({ demande }: { demande: DemandeAccueil }) {
  const [state, action, pending] = useActionState(qualifierDemande, {});
  const personas = Object.keys(PERSONA_LABELS) as Persona[];

  return (
    <form action={action} className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Qualification</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        À remplir après le rendez-vous d&apos;accueil. Le profil retenu n&apos;est
        pas une étiquette : il indique ce que cette personne attend réellement du
        guichet, et donc laquelle des deux suites a du sens.
      </p>

      <input type="hidden" name="demande_id" value={demande.id} />

      <label htmlFor="persona" className="mb-1 block text-sm font-medium">
        Profil
      </label>
      <select
        id="persona"
        name="persona"
        defaultValue={demande.persona ?? ""}
        className={champ}
        style={bordure}
      >
        <option value="">Non déterminé</option>
        {personas.map((p) => (
          <option key={p} value={p}>
            {PERSONA_LABELS[p]}
          </option>
        ))}
      </select>

      {demande.persona && (
        <p className="mt-2 rounded-md p-3 text-xs" style={{ background: "var(--color-surface-alt)" }}>
          {PERSONA_DESCRIPTIONS[demande.persona]}
        </p>
      )}

      <label htmlFor="notes_coach" className="mb-1 mt-4 block text-sm font-medium">
        Notes d&apos;accueil
      </label>
      <textarea
        id="notes_coach"
        name="notes_coach"
        rows={5}
        defaultValue={demande.notes_coach ?? ""}
        placeholder="Ce que vous avez compris du projet, ce qui bloque, ce qui a été dit…"
        className={champ}
        style={bordure}
      />

      <FieldError message={state.error} />
      <button type="submit" disabled={pending} className="btn btn-outline mt-4">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {state.success && (
        <span className="ml-3 text-sm" style={{ color: "var(--color-success)" }}>
          Enregistré.
        </span>
      )}
    </form>
  );
}

export function FormOrientation({
  demandeId,
  orientations,
}: {
  demandeId: string;
  orientations: Orientation[];
}) {
  const [state, action, pending] = useActionState(orienterDemande, {});

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Orienter</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        La voie rapide, décidée par vous seul·e, disponible toute l&apos;année.
        C&apos;est la réponse qui convient à la plupart des demandes.
      </p>

      {orientations.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {orientations.map((o) => (
            <li key={o.id} className="rounded-md p-3" style={{ background: "var(--color-surface-alt)" }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{o.structure}</p>
                  {o.motif && <p className="text-sm">{o.motif}</p>}
                  {o.date_relance && (
                    <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
                      À relancer le{" "}
                      {new Date(o.date_relance).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <FormIssue orientation={o} demandeId={demandeId} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action}>
        <input type="hidden" name="demande_id" value={demandeId} />

        <label htmlFor="structure" className="mb-1 block text-sm font-medium">
          Vers qui ?
        </label>
        <input
          id="structure"
          name="structure"
          required
          placeholder="UTBM, Basel Area, KMØ, HE-Arc, Ville de Delémont, autre dispositif…"
          className={champ}
          style={bordure}
        />

        <label htmlFor="motif" className="mb-1 mt-3 block text-sm font-medium">
          Pourquoi
        </label>
        <input
          id="motif"
          name="motif"
          placeholder="Ce que cette structure apporte à ce projet précis"
          className={champ}
          style={bordure}
        />

        <label htmlFor="date_relance" className="mb-1 mt-3 block text-sm font-medium">
          Relancer le
        </label>
        <input id="date_relance" name="date_relance" type="date" className={champ} style={bordure} />
        <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
          Une mise en relation dont personne ne vérifie l&apos;issue ne vaut pas
          mieux que pas de réponse du tout.
        </p>

        <FieldError message={state.error} />
        <button type="submit" disabled={pending} className="btn btn-primary mt-4">
          {pending ? "…" : "Enregistrer l'orientation"}
        </button>
      </form>
    </div>
  );
}

function FormIssue({ orientation, demandeId }: { orientation: Orientation; demandeId: string }) {
  const [, action, pending] = useActionState(majIssueOrientation, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="orientation_id" value={orientation.id} />
      <input type="hidden" name="demande_id" value={demandeId} />
      <select
        name="issue"
        defaultValue={orientation.issue}
        aria-label="Issue de l'orientation"
        className="rounded-md border px-2 py-1 text-xs"
        style={bordure}
      >
        {(Object.keys(ORIENTATION_ISSUE_LABELS) as Array<keyof typeof ORIENTATION_ISSUE_LABELS>).map(
          (k) => (
            <option key={k} value={k}>
              {ORIENTATION_ISSUE_LABELS[k]}
            </option>
          )
        )}
      </select>
      <button type="submit" disabled={pending} className="btn btn-outline text-xs">
        Mettre à jour
      </button>
    </form>
  );
}

export function FormPromotion({
  demandeId,
  promotions,
}: {
  demandeId: string;
  promotions: Promotion[];
}) {
  const [state, action, pending] = useActionState(verserEnPromotion, {});

  if (!promotions.length) {
    return (
      <div className="card p-5">
        <h2 className="mb-1 text-lg font-medium">Candidater à l&apos;accompagnement</h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Aucune promotion ouverte. Un administrateur doit d&apos;abord en créer
          une, avec la date du prochain comité mixte.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Candidater à l&apos;accompagnement</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        La voie longue, tranchée par le comité mixte. Il ne siège
        qu&apos;une fois par an : n&apos;engagez ce chemin que si le projet a
        vraiment besoin des ressources du consortium.
      </p>

      <input type="hidden" name="demande_id" value={demandeId} />

      <label htmlFor="promotion_id" className="mb-1 block text-sm font-medium">
        Promotion
      </label>
      <select id="promotion_id" name="promotion_id" required defaultValue="" className={champ} style={bordure}>
        <option value="" disabled>
          Choisissez…
        </option>
        {promotions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nom}
            {p.date_comite
              ? ` — comité le ${new Date(p.date_comite).toLocaleDateString("fr-FR")}`
              : ""}
          </option>
        ))}
      </select>

      <FieldError message={state.error} />
      <button type="submit" disabled={pending} className="btn btn-outline mt-4">
        {pending ? "…" : "Verser à cette promotion"}
      </button>
    </form>
  );
}

export function FormDecision({ demandeId, statut }: { demandeId: string; statut: string }) {
  const [state, action, pending] = useActionState(deciderDemande, {});

  const options =
    statut === "en_attente_comite"
      ? [
          { v: "admise", l: "Retenue par le comité" },
          { v: "non_retenue", l: "Non retenue" },
          { v: "en_accueil", l: "Remettre en accueil" },
        ]
      : [
          { v: "close", l: "Classer sans suite" },
          { v: "en_accueil", l: "Remettre en accueil" },
        ];

  return (
    <form action={action} className="card p-5">
      <h2 className="mb-3 text-lg font-medium">
        {statut === "en_attente_comite" ? "Décision du comité" : "Clore la demande"}
      </h2>
      <input type="hidden" name="demande_id" value={demandeId} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="submit"
            name="statut"
            value={o.v}
            disabled={pending}
            className="btn btn-outline"
          >
            {o.l}
          </button>
        ))}
      </div>
      <FieldError message={state.error} />
    </form>
  );
}
