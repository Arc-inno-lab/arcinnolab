"use client";

import { useEffect, useRef, useState } from "react";
import { envoyerNoteInterne } from "@/app/actions-qualification";
import { Avatar } from "@/components/Avatar";
import { useEnvoi } from "@/lib/useEnvoi";
import type { NoteDemande } from "@/lib/types";

export type Equipier = { id: string; prenom: string; nom: string; organisation?: string | null };

/** « Élodie » et « elodie » doivent se trouver pareil. */
function simplifier(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function nomComplet(e: Equipier) {
  return `${e.prenom} ${e.nom}`.trim();
}

function echapper(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Le « @recherche » en cours de frappe, juste avant le curseur. */
function rechercheEnCours(texte: string, curseur: number): { debut: number; requete: string } | null {
  const avant = texte.slice(0, curseur);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(avant);
  if (!m) return null;
  return { debut: avant.length - m[2].length - 1, requete: m[2] };
}

/**
 * La discussion de l'équipe sur une demande. Le porteur ne la voit jamais :
 * c'est l'endroit pour dire « je ne suis pas sûr que ce soit pour nous » ou
 * « @Marie Dupont, c'est ton domaine, tu peux l'appeler ? ».
 *
 * Comme dans une messagerie : taper « @ » dans le message ouvre la liste des
 * partenaires, on choisit, et la personne mentionnée est prévenue.
 */
export function FilInterne({
  demandeId,
  notes,
  equipe,
  moi,
}: {
  demandeId: string;
  /** Chaque message arrive avec sa date déjà formatée par le serveur. */
  notes: (NoteDemande & { quand: string })[];
  equipe: Equipier[];
  moi: string;
}) {
  const [texte, setTexte] = useState("");
  const [recherche, setRecherche] = useState<{ debut: number; requete: string } | null>(null);
  const [actif, setActif] = useState(0);
  const filRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  const envoi = useEnvoi(envoyerNoteInterne, {
    onSucces: () => {
      setTexte("");
      setRecherche(null);
    },
  });

  const autres = equipe.filter((e) => e.id !== moi);
  // Une personne est mentionnée tant que son « @Prénom Nom » est dans le texte.
  const mentions = autres.filter((e) => texte.includes(`@${nomComplet(e)}`)).map((e) => e.id);

  const suggestions = recherche
    ? autres
        .filter((e) => {
          const q = simplifier(recherche.requete);
          return (
            !q ||
            simplifier(e.prenom).startsWith(q) ||
            simplifier(e.nom).startsWith(q) ||
            simplifier(e.organisation ?? "").split(/[\s'’-]+/).some((mot) => mot.startsWith(q))
          );
        })
        .slice(0, 6)
    : [];
  const menuOuvert = !!recherche && suggestions.length > 0;

  // Pour surligner les mentions dans les messages déjà envoyés.
  const motifMention = equipe.length
    ? new RegExp(
        `(@(?:${equipe
          .map(nomComplet)
          .sort((a, b) => b.length - a.length)
          .map(echapper)
          .join("|")}))`,
        "g"
      )
    : null;

  useEffect(() => {
    const fil = filRef.current;
    if (fil) fil.scrollTop = fil.scrollHeight;
  }, [notes.length]);

  function suivre(valeur: string, curseur: number) {
    setTexte(valeur);
    const r = rechercheEnCours(valeur, curseur);
    setRecherche(r);
    if (r?.requete !== recherche?.requete) setActif(0);
  }

  function choisir(e: Equipier) {
    if (!recherche) return;
    const champ = champRef.current;
    const curseur = champ?.selectionStart ?? texte.length;
    const insere = `@${nomComplet(e)} `;
    const nouveau = texte.slice(0, recherche.debut) + insere + texte.slice(curseur);
    setTexte(nouveau);
    setRecherche(null);
    const position = recherche.debut + insere.length;
    requestAnimationFrame(() => {
      champ?.focus();
      champ?.setSelectionRange(position, position);
    });
  }

  function clavier(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (menuOuvert) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActif((i) => (i + 1) % suggestions.length);
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActif((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (ev.key === "Enter" || ev.key === "Tab") {
        ev.preventDefault();
        choisir(suggestions[Math.min(actif, suggestions.length - 1)]);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        setRecherche(null);
        return;
      }
    }
    // Ctrl/Cmd + Entrée envoie, comme dans la plupart des messageries.
    if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      ev.currentTarget.form?.requestSubmit();
    }
  }

  function afficher(contenu: string) {
    if (!motifMention) return contenu;
    return contenu.split(motifMention).map((morceau, i) =>
      i % 2 === 1 ? (
        <strong key={i} style={{ color: "#5b4bb7" }}>
          {morceau}
        </strong>
      ) : (
        morceau
      )
    );
  }

  return (
    <section id="discussion" className="card flex scroll-mt-6 flex-col" style={{ borderTop: "4px solid #5b4bb7" }}>
      <header className="border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold">Discussion de l&apos;équipe</h2>
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>
          Entre partenaires. Le porteur ne voit pas ces messages.
        </p>
      </header>

      <div ref={filRef} className="max-h-[22rem] overflow-y-auto px-4 py-3">
        {!notes.length ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Pas encore d&apos;échange. Tapez @ pour demander l&apos;avis d&apos;un partenaire.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => {
              // Les anciens messages notaient les mentions à part, hors du texte.
              const horsTexte = n.mentions.filter((id) => {
                const e = equipe.find((x) => x.id === id);
                return !e || !n.contenu.includes(`@${nomComplet(e)}`);
              });
              return (
                <li key={n.id} className="flex gap-2">
                  <Avatar nom={n.auteur?.nom} prenom={n.auteur?.prenom} photoUrl={n.auteur?.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                      <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                        {n.auteur_id === moi ? "Vous" : (n.auteur?.prenom ?? "Un partenaire")}
                      </span>{" "}
                      · {n.quand}
                    </p>
                    {horsTexte.length > 0 && (
                      <p className="mt-0.5 text-xs font-semibold" style={{ color: "#5b4bb7" }}>
                        {horsTexte
                          .map((id) => {
                            const e = equipe.find((x) => x.id === id);
                            return `@${id === moi ? "vous" : (e?.prenom ?? "?")}`;
                          })
                          .join(" ")}
                      </p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap rounded-md px-3 py-2 text-sm" style={{ background: "#f3f1fb" }}>
                      {afficher(n.contenu)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={envoi.onSubmit} className="border-t px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
        <input type="hidden" name="demande_id" value={demandeId} />
        {mentions.map((id) => (
          <input key={id} type="hidden" name="mentions" value={id} />
        ))}
        <label htmlFor="note-interne" className="sr-only">
          Message à l&apos;équipe
        </label>
        <div className="relative">
          {menuOuvert && (
            <ul
              id="mentions-liste"
              role="listbox"
              aria-label="Partenaires à mentionner"
              className="absolute bottom-full left-0 right-0 z-20 mb-1 overflow-hidden rounded-md border py-1 shadow-lg"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              {suggestions.map((e, i) => (
                <li
                  key={e.id}
                  id={`mention-${e.id}`}
                  role="option"
                  aria-selected={i === actif}
                  // mousedown plutôt que click : le champ ne perd pas le focus.
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    choisir(e);
                  }}
                  onMouseEnter={() => setActif(i)}
                  className="cursor-pointer px-3 py-1.5 text-sm"
                  style={{ background: i === actif ? "#ece9fa" : undefined }}
                >
                  <span className="font-semibold" style={{ color: i === actif ? "#5b4bb7" : "var(--color-text)" }}>
                    {nomComplet(e)}
                  </span>
                  {e.organisation && (
                    <span className="ml-1.5 text-xs" style={{ color: "var(--color-muted)" }}>
                      {e.organisation}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <textarea
            ref={champRef}
            id="note-interne"
            name="contenu"
            rows={3}
            required
            value={texte}
            onChange={(ev) => suivre(ev.target.value, ev.target.selectionStart)}
            onClick={(ev) => suivre(ev.currentTarget.value, ev.currentTarget.selectionStart)}
            onKeyDown={clavier}
            onBlur={() => setRecherche(null)}
            placeholder="Écrire à l'équipe… Tapez @ pour mentionner un partenaire."
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={menuOuvert}
            aria-controls="mentions-liste"
            aria-activedescendant={menuOuvert ? `mention-${suggestions[Math.min(actif, suggestions.length - 1)].id}` : undefined}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
        {mentions.length > 0 && (
          <p className="mt-1 text-xs" style={{ color: "#5b4bb7" }}>
            Sera prévenu :{" "}
            {mentions
              .map((id) => autres.find((e) => e.id === id)?.prenom)
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
        {envoi.erreur && (
          <p role="alert" className="mt-1 text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
            {envoi.erreur}
          </p>
        )}
        <button type="submit" disabled={envoi.pending} className="btn mt-2 w-full" style={{ background: "#5b4bb7", color: "#fff" }}>
          {envoi.pending ? "Envoi…" : mentions.length ? `Envoyer et prévenir (${mentions.length})` : "Envoyer"}
        </button>
      </form>
    </section>
  );
}
