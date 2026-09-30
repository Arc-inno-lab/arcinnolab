"use client";

import { useState } from "react";
import {
  abandonnerVote,
  reprendreSuivi,
  classerSansSuite,
  enregistrerQualification,
  mettreAuVote,
  orienterVersPartenaire,
  passerEnQualification,
  refuserDemande,
  rouvrirQualification,
} from "@/app/actions-qualification";
import { majIssueOrientation } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { useEnvoi } from "@/lib/useEnvoi";
import {
  ORIENTATION_ISSUE_LABELS,
  PERSONA_DESCRIPTIONS,
  PERSONA_LABELS,
  type DemandeAccueil,
  type Orientation,
  type Persona,
  type Promotion,
} from "@/lib/types";

const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

export type PartenaireChoix = { id: string; prenom: string; nom: string; organisation: string | null };

function dateCourte(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });
}

/** Étape 2 : la demande a un interlocuteur, l'appel de qualification reste à faire. */
export function EtapePriseEnCharge({ demandeId, prenomPorteur }: { demandeId: string; prenomPorteur: string }) {
  const envoi = useEnvoi(passerEnQualification, { vider: false });
  return (
    <section className="card p-5" style={{ borderLeft: "4px solid var(--color-primary-2)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--color-primary-2)" }}>
        Étape en cours · Prise en charge
      </p>
      <h2 className="mt-1 text-lg font-semibold">Prochaine étape : l&apos;appel de qualification</h2>
      <p className="mt-1 text-sm" style={{ color: "#3b4452" }}>
        Échangez avec {prenomPorteur} (fil ci-dessus) et avec l&apos;équipe (discussion interne, à droite). Quand
        l&apos;appel est calé ou fait, passez la demande en qualification : c&apos;est là qu&apos;on décide de la suite.
      </p>
      <form onSubmit={envoi.onSubmit} className="mt-3">
        <input type="hidden" name="demande_id" value={demandeId} />
        <button type="submit" disabled={envoi.pending} className="btn btn-primary">
          {envoi.pending ? "…" : "Passer en qualification"}
        </button>
        <FieldError message={envoi.erreur} />
      </form>
    </section>
  );
}

/**
 * Étape 3 : la qualification. D'abord ce qu'on sait (profil, notes d'appel,
 * ADN), ensuite la suite, en trois choix exclusifs.
 */
export function CarteQualification({
  demande,
  partenaires,
  promotions,
  qualificateur,
}: {
  demande: DemandeAccueil;
  partenaires: PartenaireChoix[];
  promotions: Promotion[];
  qualificateur: string | null;
}) {
  const fiche = useEnvoi(enregistrerQualification, { vider: false });
  const [persona, setPersona] = useState<string>(demande.persona ?? "");
  const [suite, setSuite] = useState<null | "refus" | "orientation" | "vote">(null);
  const personas = Object.keys(PERSONA_LABELS) as Persona[];
  const adn = demande.adn_arcinnolab;

  return (
    <section id="qualification" className="card scroll-mt-6 p-5" style={{ borderLeft: "4px solid #1e6b8f" }}>
      <p className="text-sm font-semibold" style={{ color: "#1e6b8f" }}>
        Étape en cours · Qualification
      </p>
      <h2 className="mt-1 text-lg font-semibold">Ce projet colle-t-il à l&apos;ADN d&apos;ArcInnoLab ?</h2>
      <p className="mt-1 text-sm" style={{ color: "#3b4452" }}>
        N&apos;importe quel partenaire peut qualifier. Après l&apos;appel avec le porteur : son profil, vos notes, votre
        avis. Puis la suite, en un choix.
      </p>

      <form onSubmit={fiche.onSubmit} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="demande_id" value={demande.id} />

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="persona" className="mb-1 block text-sm font-medium">
              Profil du porteur
            </label>
            <select id="persona" name="persona" value={persona} onChange={(e) => setPersona(e.target.value)} className={champ} style={bordure}>
              <option value="">Non déterminé</option>
              {personas.map((p) => (
                <option key={p} value={p}>
                  {PERSONA_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          {persona === "autre" && (
            <div>
              <label htmlFor="persona_precision" className="mb-1 block text-sm font-medium">
                Lequel ?
              </label>
              <input
                id="persona_precision"
                name="persona_precision"
                defaultValue={demande.persona_precision ?? ""}
                maxLength={200}
                required
                placeholder="Ex. : coopérative agricole, chercheur…"
                className={champ}
                style={bordure}
              />
            </div>
          )}
        </div>
        {persona && (
          <p className="-mt-2 rounded-md p-3 text-xs" style={{ background: "var(--color-surface-alt)" }}>
            {PERSONA_DESCRIPTIONS[persona as Persona]}
          </p>
        )}

        <div>
          <label htmlFor="notes_coach" className="mb-1 block text-sm font-medium">
            Notes de l&apos;appel
          </label>
          <textarea
            id="notes_coach"
            name="notes_coach"
            rows={4}
            defaultValue={demande.notes_coach ?? ""}
            placeholder="Ce que vous avez compris du projet, où il en est, ce qu'il attend d'ArcInnoLab…"
            className={champ}
            style={bordure}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">ADN ArcInnoLab</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "oui", l: "Oui, il colle à l'ADN" },
              { v: "non", l: "Non, hors ADN" },
            ].map((o) => (
              <label
                key={o.v}
                className="flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm"
                style={{ borderColor: "var(--color-border)" }}
              >
                <input
                  type="radio"
                  name="adn"
                  value={o.v}
                  defaultChecked={adn === (o.v === "oui")}
                  style={{ minHeight: 0, width: 16, height: 16 }}
                />
                {o.l}
              </label>
            ))}
          </div>
          {qualificateur && demande.qualifie_le && adn !== null && (
            <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
              Avis enregistré par {qualificateur} le {dateCourte(demande.qualifie_le)}.
            </p>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={fiche.pending} className="btn btn-outline">
            {fiche.pending ? "Enregistrement…" : "Enregistrer la qualification"}
          </button>
          {fiche.succes && (
            <span className="text-sm" style={{ color: "var(--color-success)" }} role="status">
              Enregistré.
            </span>
          )}
        </div>
        <FieldError message={fiche.erreur} />
      </form>

      <div className="mt-6 border-t pt-5" style={{ borderColor: "#eef1f6" }}>
        <h3 className="text-base font-semibold">Et ensuite ?</h3>
        <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
          {adn === null
            ? "Enregistrez d'abord votre avis sur l'ADN : il conditionne la mise au vote."
            : adn
              ? "Le projet colle à l'ADN : les trois suites sont possibles."
              : "Hors ADN : refusez en expliquant, ou orientez vers un partenaire qui saura l'aider."}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <ChoixSuite actif={suite === "refus"} onClick={() => setSuite("refus")} titre="Refuser" detail="Avec un message au porteur" />
          <ChoixSuite actif={suite === "orientation"} onClick={() => setSuite("orientation")} titre="Orienter" detail="Vers un partenaire d'ArcInnoLab" />
          <ChoixSuite
            actif={suite === "vote"}
            onClick={() => setSuite("vote")}
            titre="Mettre au vote"
            detail={adn ? "Vers une promotion" : "Exige l'ADN « oui »"}
            desactive={adn !== true}
          />
        </div>

        {suite === "refus" && <FormRefus demandeId={demande.id} prenom={demande.prenom} />}
        {suite === "orientation" && <FormOrientation demandeId={demande.id} partenaires={partenaires} prenom={demande.prenom} />}
        {suite === "vote" && adn === true && <FormVote demandeId={demande.id} promotions={promotions} />}

        <ClasserSansSuite demandeId={demande.id} />
      </div>
    </section>
  );
}

function ChoixSuite({
  actif,
  onClick,
  titre,
  detail,
  desactive = false,
}: {
  actif: boolean;
  onClick: () => void;
  titre: string;
  detail: string;
  desactive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-pressed={actif}
      className="rounded-xl border-2 p-3 text-left"
      style={{
        borderColor: actif ? "var(--color-primary)" : "var(--color-border)",
        background: actif ? "var(--color-primary-soft)" : "var(--color-surface)",
        opacity: desactive ? 0.5 : 1,
        cursor: desactive ? "not-allowed" : "pointer",
      }}
    >
      <span className="block text-sm font-bold">{titre}</span>
      <span className="block text-xs" style={{ color: "var(--color-muted)" }}>
        {detail}
      </span>
    </button>
  );
}

function FormRefus({ demandeId, prenom }: { demandeId: string; prenom: string }) {
  const envoi = useEnvoi(refuserDemande, { vider: false });
  return (
    <form onSubmit={envoi.onSubmit} className="mt-4 flex flex-col gap-2">
      <input type="hidden" name="demande_id" value={demandeId} />
      <label htmlFor="message-refus" className="text-sm font-medium">
        Message à {prenom} (visible sur sa page de suivi)
      </label>
      <textarea
        id="message-refus"
        name="message_porteur"
        rows={5}
        required
        minLength={30}
        placeholder="Pourquoi ArcInnoLab n'est pas le bon cadre, et vers qui se tourner si vous le savez…"
        className={champ}
        style={bordure}
      />
      <FieldError message={envoi.erreur} />
      <div>
        <button type="submit" disabled={envoi.pending} className="btn" style={{ background: "var(--color-danger)", color: "#fff" }}>
          {envoi.pending ? "…" : "Refuser la demande"}
        </button>
      </div>
    </form>
  );
}

function FormOrientation({
  demandeId,
  partenaires,
  prenom,
}: {
  demandeId: string;
  partenaires: PartenaireChoix[];
  prenom: string;
}) {
  const envoi = useEnvoi(orienterVersPartenaire, { vider: false });
  const [choix, setChoix] = useState<string>("");
  return (
    <form onSubmit={envoi.onSubmit} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="demande_id" value={demandeId} />
      <div>
        <label htmlFor="partenaire_id" className="mb-1 block text-sm font-medium">
          Vers qui ?
        </label>
        <select id="partenaire_id" name="partenaire_id" required value={choix} onChange={(e) => setChoix(e.target.value)} className={champ} style={bordure}>
          <option value="" disabled>
            Choisissez un partenaire…
          </option>
          {partenaires.map((p) => (
            <option key={p.id} value={p.id}>
              {p.organisation ? `${p.organisation} — ` : ""}
              {p.prenom} {p.nom}
            </option>
          ))}
          <option value="autre">Une autre structure…</option>
        </select>
      </div>
      {choix === "autre" && (
        <div>
          <label htmlFor="structure_autre" className="mb-1 block text-sm font-medium">
            Nom de la structure
          </label>
          <input id="structure_autre" name="structure_autre" required className={champ} style={bordure} placeholder="UTBM, Basel Area, Ville de Delémont…" />
        </div>
      )}
      <div>
        <label htmlFor="motif-orientation" className="mb-1 block text-sm font-medium">
          Ce que ce partenaire apporte au projet
        </label>
        <input id="motif-orientation" name="motif" required minLength={5} className={champ} style={bordure} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="date_relance" className="mb-1 block text-sm font-medium">
            Vérifier que le contact est pris le
          </label>
          <input id="date_relance" name="date_relance" type="date" className={champ} style={bordure} />
        </div>
      </div>
      <div>
        <label htmlFor="message-orientation" className="mb-1 block text-sm font-medium">
          Message à {prenom} <span className="font-normal" style={{ color: "var(--color-muted)" }}>(facultatif, visible sur sa page de suivi)</span>
        </label>
        <textarea id="message-orientation" name="message_porteur" rows={3} className={champ} style={bordure} />
      </div>
      <FieldError message={envoi.erreur} />
      <div>
        <button type="submit" disabled={envoi.pending} className="btn btn-primary">
          {envoi.pending ? "…" : "Orienter"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
        Un partenaire d&apos;ArcInnoLab est prévenu dans l&apos;application.
      </p>
    </form>
  );
}

function FormVote({ demandeId, promotions }: { demandeId: string; promotions: Promotion[] }) {
  const envoi = useEnvoi(mettreAuVote, { vider: false });
  if (!promotions.length) {
    return (
      <p className="mt-4 rounded-md p-3 text-sm" style={{ background: "var(--color-surface-alt)" }}>
        Aucune promotion ouverte. Un administrateur doit en ouvrir une dans le menu Promotions.
      </p>
    );
  }
  return (
    <form onSubmit={envoi.onSubmit} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="demande_id" value={demandeId} />
      <div>
        <label htmlFor="promotion_id" className="mb-1 block text-sm font-medium">
          Pour quelle promotion ?
        </label>
        <select id="promotion_id" name="promotion_id" required defaultValue={promotions.length === 1 ? promotions[0].id : ""} className={champ} style={bordure}>
          <option value="" disabled>
            Choisissez…
          </option>
          {promotions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
              {p.date_comite ? ` — comité le ${dateCourte(p.date_comite)}` : ""}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm" style={{ color: "#3b4452" }}>
        Tous les partenaires sont invités à voter pendant cinq jours. L&apos;administrateur tranche ensuite, à la lumière
        des avis.
      </p>
      <FieldError message={envoi.erreur} />
      <div>
        <button type="submit" disabled={envoi.pending} className="btn btn-primary">
          {envoi.pending ? "…" : "Ouvrir le vote des partenaires"}
        </button>
      </div>
    </form>
  );
}

function ClasserSansSuite({ demandeId }: { demandeId: string }) {
  const envoi = useEnvoi(classerSansSuite, { vider: false });
  const [confirmer, setConfirmer] = useState(false);
  return (
    <form onSubmit={envoi.onSubmit} className="mt-5 text-sm">
      <input type="hidden" name="demande_id" value={demandeId} />
      {!confirmer ? (
        <button type="button" onClick={() => setConfirmer(true)} className="underline" style={{ color: "var(--color-muted)", minHeight: 32 }}>
          Doublon ou demande vide ? Classer sans suite
        </button>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <span style={{ color: "#3b4452" }}>Aucun message ne sera envoyé au porteur.</span>
          <button type="submit" disabled={envoi.pending} className="btn btn-outline text-xs">
            Confirmer
          </button>
          <button type="button" onClick={() => setConfirmer(false)} className="text-xs underline" style={{ minHeight: 32 }}>
            Annuler
          </button>
        </span>
      )}
      <FieldError message={envoi.erreur} />
    </form>
  );
}

/** Résumé en lecture seule de la qualification, une fois la suite choisie. */
export function ResumeQualification({ demande, qualificateur }: { demande: DemandeAccueil; qualificateur: string | null }) {
  if (demande.adn_arcinnolab === null && !demande.notes_coach && !demande.persona) return null;
  return (
    <section className="card p-5">
      <h2 className="mb-2 text-lg font-semibold">Qualification</h2>
      <dl className="flex flex-col gap-2 text-sm">
        <div>
          <dt className="text-xs" style={{ color: "var(--color-muted)" }}>ADN ArcInnoLab</dt>
          <dd className="font-medium">
            {demande.adn_arcinnolab === null ? "Non renseigné" : demande.adn_arcinnolab ? "Colle à l'ADN" : "Hors ADN"}
            {qualificateur && demande.qualifie_le ? ` · ${qualificateur}, le ${dateCourte(demande.qualifie_le)}` : ""}
          </dd>
        </div>
        {demande.persona && (
          <div>
            <dt className="text-xs" style={{ color: "var(--color-muted)" }}>Profil</dt>
            <dd>
              {PERSONA_LABELS[demande.persona]}
              {demande.persona === "autre" && demande.persona_precision ? ` : ${demande.persona_precision}` : ""}
            </dd>
          </div>
        )}
        {demande.notes_coach && (
          <div>
            <dt className="text-xs" style={{ color: "var(--color-muted)" }}>Notes de l&apos;appel</dt>
            <dd className="whitespace-pre-wrap">{demande.notes_coach}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** Suivi d'une orientation : l'issue, pour savoir si la mise en relation a abouti. */
export function SuiviOrientations({ demandeId, orientations }: { demandeId: string; orientations: Orientation[] }) {
  return (
    <section className="card p-5" style={{ borderLeft: "4px solid var(--color-success)" }}>
      <h2 className="mb-1 text-lg font-semibold">Orientation</h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
        Une mise en relation dont personne ne vérifie l&apos;issue ne vaut pas mieux que pas de réponse du tout.
      </p>
      <ul className="flex flex-col gap-2">
        {orientations.map((o) => (
          <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md p-3" style={{ background: "var(--color-surface-alt)" }}>
            <div className="min-w-0">
              <p className="text-sm font-medium">{o.structure}</p>
              {o.motif && <p className="text-sm">{o.motif}</p>}
              {o.date_relance && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
                  À vérifier le {dateCourte(o.date_relance)}
                </p>
              )}
            </div>
            <FormIssue orientation={o} demandeId={demandeId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FormIssue({ orientation, demandeId }: { orientation: Orientation; demandeId: string }) {
  const envoi = useEnvoi(majIssueOrientation, { vider: false });
  return (
    <form onSubmit={envoi.onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="orientation_id" value={orientation.id} />
      <input type="hidden" name="demande_id" value={demandeId} />
      <select name="issue" defaultValue={orientation.issue} aria-label="Issue de l'orientation" className="rounded-md border px-2 py-1 text-xs" style={bordure}>
        {(Object.keys(ORIENTATION_ISSUE_LABELS) as Array<keyof typeof ORIENTATION_ISSUE_LABELS>).map((k) => (
          <option key={k} value={k}>
            {ORIENTATION_ISSUE_LABELS[k]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={envoi.pending} className="btn btn-outline text-xs">
        {envoi.succes ? "Enregistré" : "Mettre à jour"}
      </button>
    </form>
  );
}

/** Rouvrir une demande orientée, refusée ou close. */
export function Rouvrir({ demandeId }: { demandeId: string }) {
  const envoi = useEnvoi(rouvrirQualification, { vider: false });
  return (
    <form onSubmit={envoi.onSubmit} className="text-sm">
      <input type="hidden" name="demande_id" value={demandeId} />
      <button type="submit" disabled={envoi.pending} className="btn btn-outline text-xs">
        Rouvrir la qualification
      </button>
      <FieldError message={envoi.erreur} />
    </form>
  );
}

/** Pour une demande dont l'interlocuteur a disparu (compte supprimé). */
export function ReprendreSuivi({ demandeId }: { demandeId: string }) {
  const envoi = useEnvoi(reprendreSuivi, { vider: false });
  return (
    <form onSubmit={envoi.onSubmit}>
      <input type="hidden" name="demande_id" value={demandeId} />
      <button type="submit" disabled={envoi.pending} className="btn btn-primary">
        {envoi.pending ? "…" : "Reprendre le suivi"}
      </button>
      <FieldError message={envoi.erreur} />
    </form>
  );
}

/** Admin : abandonner un vote (aucun avis, ou projet à requalifier). */
export function AbandonnerVote({ demandeId }: { demandeId: string }) {
  const envoi = useEnvoi(abandonnerVote, { vider: false });
  const [confirmer, setConfirmer] = useState(false);
  return (
    <form onSubmit={envoi.onSubmit} className="text-sm">
      <input type="hidden" name="demande_id" value={demandeId} />
      {!confirmer ? (
        <button type="button" onClick={() => setConfirmer(true)} className="underline" style={{ color: "var(--color-muted)", minHeight: 32 }}>
          Abandonner ce vote et revenir à la qualification
        </button>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <span style={{ color: "#3b4452" }}>Les avis déjà rendus sont conservés dans l&apos;historique.</span>
          <button type="submit" disabled={envoi.pending} className="btn btn-outline text-xs">
            Confirmer l&apos;abandon
          </button>
          <button type="button" onClick={() => setConfirmer(false)} className="text-xs underline" style={{ minHeight: 32 }}>
            Annuler
          </button>
        </span>
      )}
      <FieldError message={envoi.erreur} />
    </form>
  );
}
