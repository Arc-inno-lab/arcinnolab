"use client";

import { useActionState, useState } from "react";
import { ouvrirTourVote, voter, cloreTourVote, prononcerDecision } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import type { Promotion, TourVote, VotePosition } from "@/lib/types";
import { VOTE_LABELS, VOTE_COLORS, TOUR_STATUT_LABELS } from "@/lib/types";

const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

function joursRestants(limite: string, maintenant: number): number {
  return Math.ceil((new Date(limite).getTime() - maintenant) / 86_400_000);
}

/** Ouverture d'une consultation, quand aucune n'est en cours. */
export function OuvrirTour({
  demandeId,
  promotionId,
  votantsAttendus,
  promotions,
}: {
  demandeId: string;
  promotionId: string | null;
  votantsAttendus: number;
  promotions: Promotion[];
}) {
  const [state, action, pending] = useActionState(ouvrirTourVote, {});

  return (
    <form action={action} className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Consulter les partenaires</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        Ouvre une consultation de <strong>cinq jours</strong> auprès des{" "}
        {votantsAttendus} partie{votantsAttendus > 1 ? "s" : ""} prenante
        {votantsAttendus > 1 ? "s" : ""}. Les avis recueillis préparent la
        décision du comité mixte : ils ne la remplacent pas.
      </p>

      {votantsAttendus < 2 && (
        <p
          className="mb-4 rounded-md p-3 text-sm"
          style={{ background: "var(--color-surface-alt)" }}
        >
          Un seul compte peut voter aujourd&apos;hui. Invitez les partenaires du
          consortium depuis <strong>Inviter</strong> pour que la consultation ait
          du sens — mais vous pouvez déjà l&apos;ouvrir pour essayer.
        </p>
      )}

      <input type="hidden" name="demande_id" value={demandeId} />

      {promotions.length > 0 && (
        <>
          <label htmlFor="promotion_id" className="mb-1 block text-sm font-medium">
            Rattacher à une promotion
          </label>
          <select
            id="promotion_id"
            name="promotion_id"
            defaultValue={promotionId ?? ""}
            className={champ}
            style={bordure}
          >
            <option value="">Sans promotion pour l&apos;instant</option>
            {promotions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
                {p.date_comite
                  ? ` — comité le ${new Date(p.date_comite).toLocaleDateString("fr-FR")}`
                  : ""}
              </option>
            ))}
          </select>
          <p className="mb-4 mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Facultatif : le rattachement peut se faire après la consultation.
          </p>
        </>
      )}

      {promotions.length === 0 && (
        <input type="hidden" name="promotion_id" value="" />
      )}

      <FieldError message={state.error} />
      <button type="submit" disabled={pending} className="btn btn-primary mt-2">
        {pending ? "…" : "Ouvrir la consultation"}
      </button>
    </form>
  );
}

/** Le tour en cours : le bulletin de la personne connectée, et l'état général. */
export function TourEnCours({
  tour,
  demandeId,
  monVote,
  estAdmin,
  maintenant,
}: {
  tour: TourVote;
  demandeId: string;
  monVote: { position: VotePosition; motif: string | null } | null;
  estAdmin: boolean;
  maintenant: number;
}) {
  const [state, action, pending] = useActionState(voter, {});
  const [position, setPosition] = useState<VotePosition>(monVote?.position ?? "favorable");

  const votes = tour.votes ?? [];
  const jours = joursRestants(tour.date_limite, maintenant);
  const echu = jours <= 0;
  const manquants = Math.max(0, tour.votants_attendus - votes.length);

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">{TOUR_STATUT_LABELS[tour.statut]}</h2>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: echu ? "var(--color-danger)" : "var(--color-primary-2)",
              color: "#fff",
            }}
          >
            {echu
              ? "Échéance dépassée"
              : `${jours} jour${jours > 1 ? "s" : ""} restant${jours > 1 ? "s" : ""}`}
          </span>
        </div>

        <p className="text-sm">
          {votes.length} avis sur {tour.votants_attendus} attendu
          {tour.votants_attendus > 1 ? "s" : ""}.{" "}
          {manquants > 0 ? (
            <span style={{ color: "var(--color-muted)" }}>
              {manquants} partenaire{manquants > 1 ? "s n'ont" : " n'a"} pas encore
              répondu.
            </span>
          ) : (
            <span style={{ color: "var(--color-success)" }}>
              Tout le monde s&apos;est prononcé.
            </span>
          )}
        </p>

        {votes.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {votes.map((v) => (
              <li
                key={v.id}
                className="rounded-md p-3"
                style={{ background: "var(--color-surface-alt)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ background: VOTE_COLORS[v.position], color: "#fff" }}
                  >
                    {VOTE_LABELS[v.position]}
                  </span>
                  <span className="text-sm font-medium">
                    {v.votant ? `${v.votant.prenom} ${v.votant.nom}` : "Partenaire"}
                    {v.votant?.organisation ? ` · ${v.votant.organisation}` : ""}
                  </span>
                </div>
                {v.motif && <p className="mt-2 text-sm">{v.motif}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={action} className="card p-5">
        <h2 className="mb-1 text-lg font-medium">
          {monVote ? "Modifier mon avis" : "Mon avis"}
        </h2>
        <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
          Vous pouvez le modifier tant que la consultation est ouverte.
        </p>

        <input type="hidden" name="tour_id" value={tour.id} />
        <input type="hidden" name="demande_id" value={demandeId} />

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(VOTE_LABELS) as VotePosition[]).map((p) => (
            <label
              key={p}
              className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium"
              style={
                position === p
                  ? { background: VOTE_COLORS[p], color: "#fff", borderColor: VOTE_COLORS[p] }
                  : bordure
              }
            >
              <input
                type="radio"
                name="position"
                value={p}
                checked={position === p}
                onChange={() => setPosition(p)}
                className="sr-only"
              />
              {VOTE_LABELS[p]}
            </label>
          ))}
        </div>

        <label htmlFor="motif" className="mb-1 block text-sm font-medium">
          Motif {position === "defavorable" && <span aria-hidden="true">*</span>}
        </label>
        <textarea
          id="motif"
          name="motif"
          rows={4}
          defaultValue={monVote?.motif ?? ""}
          required={position === "defavorable"}
          placeholder={
            position === "defavorable"
              ? "Obligatoire : c'est ce motif qui permettra d'expliquer la décision au porteur."
              : "Ce que vous voyez dans ce projet, ce que votre structure pourrait y apporter…"
          }
          className={champ}
          style={bordure}
        />
        {position === "defavorable" && (
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Écrivez-le comme une note de travail : le porteur ne lira pas ce texte
            tel quel, il servira à rédiger le message qui lui sera adressé.
          </p>
        )}

        <FieldError message={state.error} />
        <button type="submit" disabled={pending} className="btn btn-primary mt-4">
          {pending ? "…" : monVote ? "Mettre à jour mon avis" : "Enregistrer mon avis"}
        </button>
      </form>

      {estAdmin && (votes.length > 0) && (
        <CloreTour tour={tour} demandeId={demandeId} echu={echu} manquants={manquants} />
      )}
    </div>
  );
}

function CloreTour({
  tour,
  demandeId,
  echu,
  manquants,
}: {
  tour: TourVote;
  demandeId: string;
  echu: boolean;
  manquants: number;
}) {
  const [state, action, pending] = useActionState(cloreTourVote, {});
  const complet = manquants === 0;

  return (
    <form action={action} className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Clore la consultation</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        La clôture ne prononce aucune décision : elle rédige un brouillon de
        message à partir des avis, que vous relirez avant de décider.
      </p>

      {!complet && !echu && (
        <p
          className="mb-4 rounded-md p-3 text-sm"
          style={{ background: "var(--color-surface-alt)" }}
        >
          {manquants} avis manque{manquants > 1 ? "nt" : ""} encore, et
          l&apos;échéance n&apos;est pas atteinte. Attendez si vous le pouvez :
          la règle du consortium est que tout le monde se prononce.
        </p>
      )}

      {!complet && echu && (
        <p
          className="mb-4 rounded-md p-3 text-sm"
          style={{ background: "var(--color-surface-alt)" }}
        >
          L&apos;échéance est passée et {manquants} partenaire
          {manquants > 1 ? "s ne se sont" : " ne s'est"} pas prononcé.
          Vous pouvez clore sur constat d&apos;absence — les non-réponses seront
          mentionnées dans le message.
        </p>
      )}

      <input type="hidden" name="tour_id" value={tour.id} />
      <input type="hidden" name="demande_id" value={demandeId} />

      <p className="mb-2 text-sm font-medium">Sens de la décision à préparer</p>
      <FieldError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="admise"
          disabled={pending}
          className="btn btn-primary"
        >
          Candidature retenue
        </button>
        <button
          type="submit"
          name="decision"
          value="non_retenue"
          disabled={pending}
          className="btn btn-outline"
        >
          Candidature non retenue
        </button>
      </div>
    </form>
  );
}

/** Après clôture : relecture du brouillon, puis publication de la décision. */
export function ProncerDecision({
  tour,
  demandeId,
  messageActuel,
}: {
  tour: TourVote;
  demandeId: string;
  messageActuel: string | null;
}) {
  const [state, action, pending] = useActionState(prononcerDecision, {});

  return (
    <form action={action} className="card p-5">
      <h2 className="mb-1 text-lg font-medium">Message au porteur</h2>
      <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
        {tour.synthese_par_ia
          ? "Brouillon rédigé automatiquement à partir des avis."
          : "Brouillon assemblé à partir des avis."}{" "}
        Relisez-le et modifiez-le : c&apos;est exactement ce que la personne
        lira sur sa page de suivi.
      </p>

      <input type="hidden" name="demande_id" value={demandeId} />

      <textarea
        name="message_porteur"
        rows={10}
        defaultValue={messageActuel ?? tour.synthese ?? ""}
        className={champ}
        style={bordure}
      />

      <FieldError message={state.error} />

      <p className="mt-4 mb-2 text-sm font-medium">Prononcer la décision</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="statut"
          value="admise"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "…" : "Retenir la candidature"}
        </button>
        <button
          type="submit"
          name="statut"
          value="non_retenue"
          disabled={pending}
          className="btn btn-outline"
        >
          Ne pas retenir
        </button>
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--color-muted)" }}>
        Le message devient visible par le porteur dès que la décision est
        prononcée.
      </p>
    </form>
  );
}
