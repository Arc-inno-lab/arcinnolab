"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createEtapeMessage, deleteEtape, updateEtape, updateEtapeStatut } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { Avatar } from "@/components/Avatar";
import { Tiroir } from "@/components/Tiroir";
import {
  ETAPE_STATUT_COLORS,
  ETAPE_STATUT_LABELS,
  type EtapeProjet,
  type EtapeStatut,
  type MessageProjet,
} from "@/lib/types";

const STATUTS: EtapeStatut[] = ["a_faire", "en_cours", "validee", "refusee"];
const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

/**
 * La fiche d'une étape, ouverte à côté du tableau plutôt que sur une autre
 * page.
 *
 * Un kanban qui envoie ailleurs à chaque clic n'est plus un kanban : on perd
 * la vue d'ensemble au moment précis où l'on en a besoin. Le panneau garde le
 * tableau visible pendant qu'on écrit, fixe une date ou change un statut.
 */
export function PanneauEtape({
  etape,
  projetId,
  messages,
  nbDocuments,
  peutEditer,
  peutValider,
  onFermer,
}: {
  etape: EtapeProjet;
  projetId: string;
  messages: MessageProjet[];
  nbDocuments: number;
  peutEditer: boolean;
  peutValider: boolean;
  onFermer: () => void;
}) {
  const [etatFiche, actionFiche, ficheEnCours] = useActionState(updateEtape, {});
  const [pending, startTransition] = useTransition();
  const [avis, setAvis] = useState("");
  const [erreur, setErreur] = useState<string>();
  const messageRef = useRef<HTMLTextAreaElement>(null);

  function changerStatut(statut: EtapeStatut) {
    setErreur(undefined);
    const terminal = statut === "validee" || statut === "refusee";
    if (terminal && !peutValider) {
      setErreur("Seul le partenaire référent peut valider ou refuser une étape.");
      return;
    }
    startTransition(() => updateEtapeStatut(projetId, etape.id, statut, terminal ? avis : undefined));
  }

  function envoyerMessage(e: React.FormEvent) {
    e.preventDefault();
    const texte = messageRef.current?.value ?? "";
    if (!texte.trim()) return;
    startTransition(() => createEtapeMessage(projetId, etape.id, texte));
    if (messageRef.current) messageRef.current.value = "";
  }

  const enRetard =
    etape.date_echeance &&
    etape.statut !== "validee" &&
    new Date(etape.date_echeance) < new Date(new Date().toDateString());

  return (
    <Tiroir
      titre={etape.titre}
      sousTitre={ETAPE_STATUT_LABELS[etape.statut]}
      onFermer={onFermer}
    >
          <section>
            <h3 className="mb-2 text-sm font-medium">Statut</h3>
            <div className="flex flex-wrap gap-2">
              {STATUTS.map((s) => {
                const terminal = s === "validee" || s === "refusee";
                const bloque = terminal && !peutValider;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={pending || s === etape.statut || bloque || !peutEditer}
                    aria-pressed={s === etape.statut}
                    onClick={() => changerStatut(s)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium"
                    style={
                      s === etape.statut
                        ? { background: ETAPE_STATUT_COLORS[s], color: "#fff" }
                        : {
                            background: "var(--color-surface-alt)",
                            color: bloque ? "var(--color-muted)" : "var(--color-text)",
                            opacity: bloque ? 0.6 : 1,
                          }
                    }
                  >
                    {ETAPE_STATUT_LABELS[s]}
                  </button>
                );
              })}
            </div>

            {peutValider ? (
              <div className="mt-3">
                <label htmlFor="avis-etape" className="mb-1 block text-sm font-medium">
                  Avis à joindre en cas de validation ou de refus
                </label>
                <textarea
                  id="avis-etape"
                  rows={2}
                  value={avis}
                  onChange={(e) => setAvis(e.target.value)}
                  placeholder="Ce qui a emporté la décision…"
                  className={champ}
                  style={bordure}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
                Vous menez le plan de travail entre « À faire » et « En cours ».
                La validation revient au partenaire référent : c&apos;est son
                avis, pas un simple statut d&apos;avancement.
              </p>
            )}

            {erreur && (
              <p className="mt-2 text-sm" style={{ color: "var(--color-danger)" }}>
                {erreur}
              </p>
            )}

            {etape.avis && (
              <div className="mt-3 rounded-md p-3" style={{ background: "var(--color-surface-alt)" }}>
                <p className="mb-1 text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                  Avis du partenaire référent
                </p>
                <p className="whitespace-pre-wrap text-sm">{etape.avis}</p>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Fiche</h3>
            {peutEditer ? (
              <form action={actionFiche}>
                <input type="hidden" name="projet_id" value={projetId} />
                <input type="hidden" name="etape_id" value={etape.id} />

                <label htmlFor="titre-etape" className="mb-1 block text-sm font-medium">
                  Titre
                </label>
                <input
                  id="titre-etape"
                  name="titre"
                  defaultValue={etape.titre}
                  required
                  className={champ}
                  style={bordure}
                />

                <label htmlFor="echeance-etape" className="mb-1 mt-3 block text-sm font-medium">
                  Date butoir
                </label>
                <input
                  id="echeance-etape"
                  name="date_echeance"
                  type="date"
                  defaultValue={etape.date_echeance ?? ""}
                  className={champ}
                  style={bordure}
                />

                <label htmlFor="description-etape" className="mb-1 mt-3 block text-sm font-medium">
                  De quoi s&apos;agit-il ?
                </label>
                <textarea
                  id="description-etape"
                  name="description"
                  rows={5}
                  defaultValue={etape.description ?? ""}
                  placeholder="Ce qu'il faut produire, où en est le travail, ce qui bloque…"
                  className={champ}
                  style={bordure}
                />

                <FieldError message={etatFiche.error} />
                {etatFiche.success && (
                  <p className="mt-2 text-sm" style={{ color: "var(--color-success)" }} role="status">
                    Enregistré.
                  </p>
                )}
                <button type="submit" disabled={ficheEnCours} className="btn btn-primary mt-3">
                  {ficheEnCours ? "Enregistrement…" : "Enregistrer"}
                </button>
              </form>
            ) : (
              <>
                {etape.date_echeance && (
                  <p className="text-sm">
                    Date butoir :{" "}
                    {new Date(etape.date_echeance).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm">
                  {etape.description || "Aucune description."}
                </p>
              </>
            )}

            {enRetard && (
              <p className="mt-2 text-sm" style={{ color: "var(--color-danger)" }}>
                La date butoir est dépassée.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Discussion ({messages.length})</h3>
            {messages.length ? (
              <ul className="mb-3 flex flex-col gap-3">
                {messages.map((m) => (
                  <li key={m.id} className="flex gap-2">
                    <Avatar
                      nom={m.auteur?.nom}
                      prenom={m.auteur?.prenom}
                      photoUrl={m.auteur?.photo_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                        {m.auteur ? `${m.auteur.prenom} ${m.auteur.nom}` : "Un membre"}
                        {" · "}
                        {new Date(m.created_at).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{m.contenu}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm" style={{ color: "var(--color-muted)" }}>
                Rien n&apos;a encore été dit sur cette étape.
              </p>
            )}

            <form onSubmit={envoyerMessage}>
              <label htmlFor="message-etape" className="sr-only">
                Écrire sur cette étape
              </label>
              <textarea
                id="message-etape"
                ref={messageRef}
                rows={3}
                placeholder="Poser une question, signaler une avancée…"
                className={champ}
                style={bordure}
              />
              <button type="submit" disabled={pending} className="btn btn-outline mt-2">
                Envoyer
              </button>
            </form>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Pièces jointes ({nbDocuments})</h3>
            <Link href={`/projets/${projetId}/etapes/${etape.id}`} className="btn btn-outline">
              Ouvrir la page complète de l&apos;étape
            </Link>
          </section>

          {peutEditer && etape.statut !== "validee" && etape.statut !== "refusee" && (
            <section>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await deleteEtape(projetId, etape.id);
                    onFermer();
                  });
                }}
                className="btn btn-outline text-xs"
                style={{ color: "var(--color-danger)", borderColor: "var(--color-danger)" }}
              >
                Supprimer cette étape
              </button>
            </section>
          )}
    </Tiroir>
  );
}
