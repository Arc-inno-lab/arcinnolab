"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createEtapeMessage, deleteEtape, updateEtape } from "@/app/actions";
import {
  deplacerEtape,
  deplacerRendezVous,
  repondreRendezVous,
  trancherEtape,
} from "@/app/actions-parcours";
import { FieldError } from "@/components/FieldError";
import { Avatar } from "@/components/Avatar";
import { Tiroir } from "@/components/Tiroir";
import { heure, jourLong } from "@/lib/parcours";
import { useEnvoi } from "@/lib/useEnvoi";
import { RDV_MODE_LABELS, type ColonneProjet, type EtapeProjet, type MessageProjet } from "@/lib/types";

const champ = "w-full rounded-md border px-3 py-2 text-sm";
const bordure = { borderColor: "var(--color-border)" };

/**
 * La fiche d'une étape, ouverte à côté du tableau.
 *
 * Trois blocs, dans l'ordre où on les cherche : où en est-elle (colonne et
 * avis du référent), de quoi s'agit-il (fiche), qu'en dit-on (discussion).
 * Un rendez-vous a son propre bloc : quand, comment, confirmé ou non.
 */
export function PanneauEtape({
  etape,
  projetId,
  colonnes,
  messages,
  nbDocuments,
  noms,
  moi,
  proposeParLePorteur,
  peutEditer,
  peutValider,
  enRetard,
  onFermer,
}: {
  etape: EtapeProjet;
  projetId: string;
  colonnes: ColonneProjet[];
  messages: MessageProjet[];
  nbDocuments: number;
  noms: Record<string, string>;
  moi: string;
  proposeParLePorteur: boolean;
  peutEditer: boolean;
  peutValider: boolean;
  enRetard: boolean;
  onFermer: () => void;
}) {
  const fiche = useEnvoi(updateEtape, { vider: false });
  const autreDate = useEnvoi(deplacerRendezVous, { vider: false });
  const [pending, startTransition] = useTransition();
  const [avis, setAvis] = useState(etape.avis ?? "");
  const [erreur, setErreur] = useState<string>();
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const rdv = etape.type === "rendez_vous";
  const colonne = colonnes.find((c) => c.id === etape.colonne_id);
  const verrouillee = etape.validation === "validee" && !peutValider;

  function lancer(f: () => Promise<{ error?: string }>) {
    setErreur(undefined);
    startTransition(async () => {
      const r = await f();
      if (r.error) setErreur(r.error);
    });
  }

  function envoyerMessage(e: React.FormEvent) {
    e.preventDefault();
    const texte = messageRef.current?.value ?? "";
    if (!texte.trim()) return;
    startTransition(() => createEtapeMessage(projetId, etape.id, texte));
    if (messageRef.current) messageRef.current.value = "";
  }

  const sousTitre = rdv
    ? etape.rdv_statut === "confirme"
      ? "Rendez-vous confirmé"
      : etape.rdv_statut === "annule"
        ? "Rendez-vous annulé"
        : "Rendez-vous à confirmer"
    : [
        colonne?.nom,
        etape.validation === "validee"
          ? "validée"
          : etape.validation === "a_valider"
            ? "à valider"
            : etape.validation === "refusee"
              ? "à reprendre"
              : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <Tiroir titre={etape.titre} sousTitre={sousTitre} onFermer={onFermer}>
      {erreur && (
        <p role="alert" className="rounded-md px-3 py-2 text-sm" style={{ background: "var(--color-accent-soft)", color: "var(--color-danger)" }}>
          {erreur}
        </p>
      )}

      {rdv && etape.rdv_debut && (
        <section className="rounded-lg p-4" style={{ background: "#fdf6e9" }}>
          <h3 className="mb-1 text-sm font-semibold" style={{ color: "#7a4a00" }}>
            Rendez-vous
          </h3>
          <p className="text-base font-semibold first-letter:uppercase">
            {jourLong(etape.rdv_debut)} à {heure(etape.rdv_debut)}
          </p>
          <p className="text-sm" style={{ color: "#3b4452" }}>
            {etape.rdv_mode ? RDV_MODE_LABELS[etape.rdv_mode] : ""}
            {etape.rdv_lieu ? ` · ${etape.rdv_lieu}` : ""}
            {etape.rdv_avec ? ` · avec ${noms[etape.rdv_avec] ?? "un membre de l'équipe"}` : " · avec toute l'équipe"}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            {etape.rdv_statut === "confirme"
              ? "Confirmé."
              : etape.rdv_statut === "annule"
                ? "Annulé."
                : proposeParLePorteur
                  ? `Proposé par ${noms[etape.cree_par!] ?? "le porteur"} : à vous de confirmer.`
                  : `Proposé par ${etape.cree_par === moi ? "vous" : (etape.cree_par ? (noms[etape.cree_par] ?? "l'équipe") : "l'équipe")} : en attente de la réponse du porteur.`}
          </p>

          {peutEditer && etape.rdv_statut !== "annule" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {etape.rdv_statut === "propose" && proposeParLePorteur && (
                <button type="button" disabled={pending} onClick={() => lancer(() => repondreRendezVous(projetId, etape.id, "confirme"))} className="btn btn-primary">
                  Confirmer
                </button>
              )}
              <a href={`/api/rdv/${etape.id}/ics`} className="btn btn-outline">
                Ajouter à mon agenda
              </a>
              <button type="button" disabled={pending} onClick={() => lancer(() => repondreRendezVous(projetId, etape.id, "annule"))} className="btn btn-outline" style={{ color: "var(--color-danger)" }}>
                Annuler le rendez-vous
              </button>
            </div>
          )}

          {peutEditer && (
            <form onSubmit={autreDate.onSubmit} className="mt-4 border-t pt-3" style={{ borderColor: "#f0e2c4" }}>
              <p className="mb-2 text-sm font-medium">Proposer une autre date</p>
              <input type="hidden" name="projet_id" value={projetId} />
              <input type="hidden" name="etape_id" value={etape.id} />
              <div className="flex flex-wrap gap-2">
                <label htmlFor="autre-jour" className="sr-only">
                  Jour
                </label>
                <input id="autre-jour" name="rdv_jour" type="date" required className={`${champ} max-w-[11rem]`} style={bordure} />
                <label htmlFor="autre-heure" className="sr-only">
                  Heure
                </label>
                <input id="autre-heure" name="rdv_heure" type="time" step={900} required defaultValue="14:00" className={`${champ} max-w-[8rem]`} style={bordure} />
                <button type="submit" disabled={autreDate.pending} className="btn btn-outline">
                  {autreDate.pending ? "Envoi…" : "Proposer"}
                </button>
              </div>
              <FieldError message={autreDate.erreur} />
              {autreDate.succes && (
                <p className="mt-2 text-sm" style={{ color: "var(--color-success)" }} role="status">
                  Nouvelle date proposée.
                </p>
              )}
            </form>
          )}
        </section>
      )}

      {!rdv && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Où en est-elle ?</h3>
          <label htmlFor="colonne-etape" className="sr-only">
            Colonne
          </label>
          <select
            id="colonne-etape"
            value={etape.colonne_id ?? ""}
            disabled={!peutEditer || verrouillee || pending}
            onChange={(e) => lancer(() => deplacerEtape(projetId, etape.id, e.target.value))}
            className={champ}
            style={bordure}
          >
            {colonnes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
                {c.terminale ? " (soumet au référent)" : ""}
              </option>
            ))}
          </select>

          {peutValider ? (
            <div className="mt-4 rounded-lg p-4" style={{ background: "var(--color-surface-alt)" }}>
              <p className="mb-2 text-sm font-semibold">
                {etape.validation === "a_valider"
                  ? "Le porteur l'a marquée terminée : à vous de trancher."
                  : etape.validation === "validee"
                    ? "Vous l'avez validée."
                    : etape.validation === "refusee"
                      ? "Renvoyée au porteur, à reprendre."
                      : "Votre avis de référent"}
              </p>
              <label htmlFor="avis-etape" className="mb-1 block text-sm" style={{ color: "var(--color-muted)" }}>
                Un mot pour le porteur (conseillé en cas de refus)
              </label>
              <textarea
                id="avis-etape"
                rows={2}
                value={avis}
                onChange={(e) => setAvis(e.target.value)}
                placeholder="Ce qui manque, ce qui a emporté la décision…"
                className={champ}
                style={bordure}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || etape.validation === "validee"}
                  onClick={() => lancer(() => trancherEtape(projetId, etape.id, "validee", avis))}
                  className="btn"
                  style={{ background: "var(--color-success)", color: "#fff" }}
                >
                  Valider
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => lancer(() => trancherEtape(projetId, etape.id, "refusee", avis))}
                  className="btn btn-outline"
                >
                  À reprendre
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
              {verrouillee
                ? "Étape validée par le référent : elle ne se modifie plus."
                : "Quand c'est fait, placez-la dans la dernière colonne : le référent la validera."}
            </p>
          )}

          {etape.avis && !peutValider && (
            <div className="mt-3 rounded-md p-3" style={{ background: "var(--color-surface-alt)" }}>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                Avis du référent
              </p>
              <p className="whitespace-pre-wrap text-sm">{etape.avis}</p>
            </div>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Fiche</h3>
        {peutEditer && !verrouillee ? (
          <form onSubmit={fiche.onSubmit}>
            <input type="hidden" name="projet_id" value={projetId} />
            <input type="hidden" name="etape_id" value={etape.id} />

            <label htmlFor="titre-etape" className="mb-1 block text-sm font-medium">
              Titre
            </label>
            <input id="titre-etape" name="titre" defaultValue={etape.titre} required className={champ} style={bordure} />

            {!rdv && (
              <>
                <label htmlFor="echeance-etape" className="mb-1 mt-3 block text-sm font-medium">
                  Date butoir
                </label>
                <input id="echeance-etape" name="date_echeance" type="date" defaultValue={etape.date_echeance ?? ""} className={champ} style={bordure} />
              </>
            )}

            <label htmlFor="description-etape" className="mb-1 mt-3 block text-sm font-medium">
              {rdv ? "Ordre du jour" : "De quoi s'agit-il ?"}
            </label>
            <textarea
              id="description-etape"
              name="description"
              rows={4}
              defaultValue={etape.description ?? ""}
              placeholder={rdv ? "Ce dont on veut parler…" : "Ce qu'il faut produire, ce qui bloque…"}
              className={champ}
              style={bordure}
            />

            <FieldError message={fiche.erreur} />
            {fiche.succes && (
              <p className="mt-2 text-sm" style={{ color: "var(--color-success)" }} role="status">
                Enregistré.
              </p>
            )}
            <button type="submit" disabled={fiche.pending} className="btn btn-primary mt-3">
              {fiche.pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{etape.description || "Aucune description."}</p>
        )}

        {enRetard && (
          <p className="mt-2 text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
            La date butoir est dépassée.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Discussion ({messages.length})</h3>
        {messages.length ? (
          <ul className="mb-3 flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-2">
                <Avatar nom={m.auteur?.nom} prenom={m.auteur?.prenom} photoUrl={m.auteur?.photo_url} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                    {m.auteur ? `${m.auteur.prenom} ${m.auteur.nom}` : "Un membre"}
                    {" · "}
                    {new Date(m.created_at).toLocaleString("fr-FR", {
                      timeZone: "Europe/Paris",
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
          <textarea id="message-etape" ref={messageRef} rows={3} placeholder="Poser une question, signaler une avancée…" className={champ} style={bordure} />
          <button type="submit" disabled={pending} className="btn btn-outline mt-2">
            Envoyer
          </button>
        </form>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Pièces jointes ({nbDocuments})</h3>
        <Link href={`/projets/${projetId}/etapes/${etape.id}`} className="btn btn-outline">
          Déposer ou consulter les pièces
        </Link>
      </section>

      {peutEditer && (peutValider || etape.validation !== "validee") && (
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
            {rdv ? "Supprimer ce rendez-vous" : "Supprimer cette étape"}
          </button>
        </section>
      )}
    </Tiroir>
  );
}
