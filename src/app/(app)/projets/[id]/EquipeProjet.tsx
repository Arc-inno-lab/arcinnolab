"use client";

import { useActionState, useState, useTransition } from "react";
import { detacherPartenaire, rattacherPartenaire } from "@/app/actions";
import { InvitationForm } from "../../invitations/new/InvitationForm";
import { CancelInvitationButton } from "../../admin/CancelInvitationButton";
import { FieldError } from "@/components/FieldError";
import { Avatar } from "@/components/Avatar";
import { Tiroir } from "@/components/Tiroir";
import type { Invitation, MembreProjet, Profile } from "@/lib/types";

type Referent = { nom: string; prenom: string; email: string | null; photo_url: string | null };

/**
 * Qui travaille sur ce projet, en deux colonnes.
 *
 * Porteurs d'un côté, partenaires de l'autre : ce sont deux populations aux
 * droits différents, les mélanger dans une seule liste obligeait à lire chaque
 * ligne pour comprendre qui est qui. Les deux gestes d'administration —
 * inviter un porteur, rattacher un partenaire — tiennent chacun dans un
 * bouton, et leur formulaire s'ouvre dans un panneau plutôt que d'allonger la
 * page pour tout le monde.
 */
export function EquipeProjet({
  projetId,
  membres,
  invitations,
  referent,
  partenaires,
  partenairesDisponibles,
  peutGerer,
}: {
  projetId: string;
  membres: MembreProjet[];
  invitations: Invitation[];
  referent: Referent | null;
  partenaires: Profile[];
  partenairesDisponibles: Profile[];
  peutGerer: boolean;
}) {
  const [tiroir, setTiroir] = useState<null | "porteur" | "partenaire">(null);
  const [state, action, pending] = useActionState(rattacherPartenaire, {});
  const [retrait, startRetrait] = useTransition();

  return (
    <section aria-labelledby="equipe-heading" className="card p-5">
      <h2 id="equipe-heading" className="mb-1 text-lg font-medium">
        Qui travaille sur ce projet
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-muted)" }}>
        Les personnes listées ici sont les seules que le porteur voit et peut
        contacter. Le reste du consortium ne lui apparaît pas.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* ── Porteurs ── */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Porteurs ({membres.length + invitations.length})
            </h3>
            {peutGerer && (
              <button
                type="button"
                onClick={() => setTiroir("porteur")}
                className="btn btn-outline text-xs"
              >
                + Inviter
              </button>
            )}
          </div>

          {!membres.length && !invitations.length ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Aucun porteur rattaché.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {membres.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <Avatar
                    nom={m.profile?.nom}
                    prenom={m.profile?.prenom}
                    photoUrl={m.profile?.photo_url}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.profile?.prenom} {m.profile?.nom}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--color-muted)" }}>
                      {m.profile?.organisation || m.profile?.email}
                    </p>
                  </div>
                </li>
              ))}
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar nom={inv.nom} prenom={inv.prenom} photoUrl={null} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {inv.prenom || inv.nom
                          ? `${inv.prenom ?? ""} ${inv.nom ?? ""}`.trim()
                          : inv.email}
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--color-muted)" }}>
                        invitation en attente
                      </p>
                    </div>
                  </div>
                  {peutGerer && <CancelInvitationButton id={inv.id} />}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Partenaires ── */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Partenaires ({partenaires.length + (referent ? 1 : 0)})
            </h3>
            {peutGerer && (
              <button
                type="button"
                onClick={() => setTiroir("partenaire")}
                className="btn btn-outline text-xs"
              >
                Gérer
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {referent && (
              <li className="flex items-center gap-2 text-sm">
                <Avatar
                  nom={referent.nom}
                  prenom={referent.prenom}
                  photoUrl={referent.photo_url}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {referent.prenom} {referent.nom}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-primary)" }}>
                    référent
                  </p>
                </div>
              </li>
            )}
            {partenaires.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Avatar nom={p.nom} prenom={p.prenom} photoUrl={p.photo_url} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {p.prenom} {p.nom}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--color-muted)" }}>
                    {p.organisation || "partenaire rattaché"}
                  </p>
                </div>
              </li>
            ))}
            {!referent && !partenaires.length && (
              <li className="text-sm" style={{ color: "var(--color-muted)" }}>
                Aucun partenaire rattaché.
              </li>
            )}
          </ul>
        </div>
      </div>

      {tiroir === "porteur" && (
        <Tiroir
          titre="Inviter un porteur"
          sousTitre="Le lien est à transmettre vous-même : l'envoi automatique d'e-mails n'est pas branché."
          onFermer={() => setTiroir(null)}
        >
          <InvitationForm canInvitePartenaire={false} projetId={projetId} />
        </Tiroir>
      )}

      {tiroir === "partenaire" && (
        <Tiroir
          titre="Partenaires du projet"
          sousTitre="Ce rattachement décide de ce que le porteur voit."
          onFermer={() => setTiroir(null)}
        >
          <section>
            <h3 className="mb-2 text-sm font-medium">Rattachés</h3>
            {referent && (
              <p className="mb-2 text-sm">
                <strong>
                  {referent.prenom} {referent.nom}
                </strong>{" "}
                <span style={{ color: "var(--color-muted)" }}>
                  — référent du projet, rattaché d&apos;office.
                </span>
              </p>
            )}
            {!partenaires.length ? (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                Aucun autre partenaire pour l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {partenaires.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md p-2 text-sm"
                    style={{ background: "var(--color-surface-alt)" }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar nom={p.nom} prenom={p.prenom} photoUrl={p.photo_url} size="sm" />
                      <span>
                        {p.prenom} {p.nom}
                        {p.organisation && (
                          <span style={{ color: "var(--color-muted)" }}> · {p.organisation}</span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={retrait}
                      onClick={() => startRetrait(() => detacherPartenaire(projetId, p.id))}
                      className="btn btn-outline text-xs"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Rattacher quelqu&apos;un</h3>
            <form action={action} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="projet_id" value={projetId} />
              <div className="min-w-[200px] flex-1">
                <label htmlFor="partenaire" className="mb-1 block text-sm">
                  Partenaire
                </label>
                <select
                  id="partenaire"
                  name="partenaire_id"
                  required
                  disabled={!partenairesDisponibles.length}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <option value="">
                    {partenairesDisponibles.length
                      ? "Choisir…"
                      : "Tout le monde est déjà rattaché"}
                  </option>
                  {partenairesDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                      {p.organisation ? ` — ${p.organisation}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={pending || !partenairesDisponibles.length}
                className="btn btn-primary"
              >
                {pending ? "…" : "Rattacher"}
              </button>
            </form>
            <FieldError message={state.error} />
          </section>
        </Tiroir>
      )}
    </section>
  );
}
