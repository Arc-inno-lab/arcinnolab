"use client";

import { useEffect, useRef, useState } from "react";
import { envoyerMessageProjet } from "@/app/actions";
import { PREFIXE_DOCUMENT } from "@/lib/parcours";
import { TAILLE_MAX_DOCUMENT, useEnvoi } from "@/lib/useEnvoi";
import type { DocumentProjet, MessageProjet } from "@/lib/types";

const FUSEAU = "Europe/Paris";

function jourDe(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function heureDe(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
}

function titreJour(jour: string, aujourdhui: string) {
  if (jour === aujourdhui) return "Aujourd'hui";
  const d = new Date(`${jour}T12:00:00Z`);
  const texte = d.toLocaleDateString("fr-FR", { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * La conversation du porteur avec l'équipe de son projet, comme dans une
 * messagerie de téléphone : ses messages à droite, ceux de l'équipe à
 * gauche, un trombone pour joindre un document.
 */
export function ChatProjet({
  projetId,
  messages,
  documents,
  moi,
  aujourdhui,
  texteInitial = "",
  hauteur,
}: {
  projetId: string;
  messages: MessageProjet[];
  documents: DocumentProjet[];
  moi: string;
  /** Date du jour (AAAA-MM-JJ, heure de Paris), fournie par le serveur. */
  aujourdhui: string;
  texteInitial?: string;
  /** Hauteur fixe de la zone de messages (colonne de droite sur ordinateur). */
  hauteur?: string;
}) {
  const [fichier, setFichier] = useState<string | null>(null);
  const [tropLourd, setTropLourd] = useState(false);
  const envoi = useEnvoi(envoyerMessageProjet, {
    onSucces: (form) => {
      // Vider aussi la phrase préremplie (« J'ai besoin d'aide pour… ») :
      // reset() la remettrait, puisque c'est sa valeur initiale.
      const zone = form.elements.namedItem("contenu") as HTMLTextAreaElement | null;
      if (zone) zone.value = "";
      setFichier(null);
    },
  });
  const fichierRef = useRef<HTMLInputElement>(null);
  const filRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fil = filRef.current;
    if (fil) fil.scrollTop = fil.scrollHeight;
  }, [messages.length]);

  const parNom = new Map(documents.map((d) => [d.nom_fichier, d]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={filRef} className="flex-1 overflow-y-auto px-4 py-4" style={hauteur ? { height: hauteur } : undefined}>
        {!messages.length ? (
          <p className="py-8 text-center text-[17px]" style={{ color: "var(--color-muted)" }}>
            Pas encore de message. Une question, une nouvelle, un document : écrivez ici, l&apos;équipe vous répond.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m, i) => {
              const jour = jourDe(m.created_at);
              const separateur = i === 0 || jourDe(messages[i - 1].created_at) !== jour;
              const mien = m.auteur_id === moi;
              const doc = m.contenu.startsWith(PREFIXE_DOCUMENT) ? parNom.get(m.contenu.slice(PREFIXE_DOCUMENT.length)) : undefined;
              return (
                <li key={m.id} className="flex flex-col">
                  {separateur && (
                    <span className="mx-auto my-3 rounded-full px-3 py-1 text-sm" style={{ background: "#e9edf4", color: "#3b4452" }}>
                      {titreJour(jour, aujourdhui)}
                    </span>
                  )}
                  <div className={`flex flex-col gap-1 ${mien ? "items-end" : "items-start"}`}>
                    {doc ? (
                      <a
                        href={doc.lien_fichier}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex max-w-[85%] items-center gap-2 rounded-xl border px-4 py-3 text-[16px]"
                        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
                          <path d="M14 3v5h5" />
                        </svg>
                        <span className="truncate">{doc.nom_fichier}</span>
                      </a>
                    ) : (
                      <p
                        className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[16px] leading-snug"
                        style={
                          mien
                            ? { background: "var(--color-primary)", color: "#fff", borderBottomRightRadius: 6 }
                            : { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderBottomLeftRadius: 6 }
                        }
                      >
                        {m.contenu}
                      </p>
                    )}
                    <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {mien ? "Vous" : (m.auteur?.prenom ?? "L'équipe")} · {heureDe(m.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={envoi.onSubmit}
        className="border-t px-3 pt-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", paddingBottom: 12 }}
      >
        <input type="hidden" name="projet_id" value={projetId} />
        {fichier && (
          <p className="mb-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--color-surface-alt)" }}>
            <span className="truncate">Joint : {fichier}</span>
            <button
              type="button"
              className="text-sm font-semibold"
              style={{ color: "var(--color-danger)", minHeight: 32 }}
              onClick={() => {
                if (fichierRef.current) fichierRef.current.value = "";
                setFichier(null);
              }}
            >
              Retirer
            </button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fichierRef.current?.click()}
            aria-label="Joindre un document"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6L15 6.6" />
            </svg>
          </button>
          <input
            ref={fichierRef}
            type="file"
            name="fichier"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              const lourd = !!f && f.size > TAILLE_MAX_DOCUMENT;
              setTropLourd(lourd);
              if (lourd) e.currentTarget.value = "";
              setFichier(f && !lourd ? f.name : null);
            }}
          />
          <label htmlFor="message-porteur" className="sr-only">
            Votre message
          </label>
          <textarea
            id="message-porteur"
            name="contenu"
            rows={1}
            defaultValue={texteInitial}
            placeholder="Votre message…"
            className="champ-grand min-w-0 flex-1 resize-none"
          />
          <button type="submit" disabled={envoi.pending} className="btn btn-primary btn-grand shrink-0">
            {envoi.pending ? "…" : "Envoyer"}
          </button>
        </div>
        {(tropLourd || envoi.erreur) && (
          <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
            {tropLourd ? "Ce document dépasse 4 Mo : envoyez une version plus légère." : envoi.erreur}
          </p>
        )}
      </form>
    </div>
  );
}
