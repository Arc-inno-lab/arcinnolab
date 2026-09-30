"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { deplacerDemande } from "@/app/actions-qualification";
import { DEMANDE_STATUT_COLORS, DEMANDE_STATUT_LABELS, PAYS_LABELS, type DemandeStatut, type Pays } from "@/lib/types";

export type CarteDemande = {
  id: string;
  statut: DemandeStatut;
  titre: string;
  porteur: string;
  organisation: string | null;
  pays: Pays;
  anciennete: string;
  sansReponse: number | null;
  coach: string | null;
  coachId: string | null;
  adn: boolean | null;
  vote: { exprimes: number; attendus: number; monAvisAttendu: boolean } | null;
  voteClos: boolean;
  misAJour: string;
};

type Colonne = {
  cle: string;
  titre: string;
  aide: string;
  statuts: DemandeStatut[];
  /** Statut posé quand on y dépose une carte ; absent = colonne de décision. */
  cible?: DemandeStatut;
};

const COLONNES: Colonne[] = [
  { cle: "nouvelles", titre: "Nouvelles", aide: "Personne ne les suit encore", statuts: ["nouvelle"] },
  { cle: "prise", titre: "Prise en charge", aide: "Premiers échanges", statuts: ["en_accueil"], cible: "en_accueil" },
  {
    cle: "qualification",
    titre: "Qualification",
    aide: "Appel, ADN, choix de la suite",
    statuts: ["en_qualification", "en_attente_comite"],
    cible: "en_qualification",
  },
  { cle: "vote", titre: "Au vote", aide: "Avis des partenaires, puis décision", statuts: ["en_instruction"] },
  { cle: "decidees", titre: "Décidées", aide: "Admises, orientées, refusées", statuts: ["admise", "orientee", "non_retenue", "close"] },
];

/** Au-delà, les demandes décidées encombrent la colonne : on montre les plus récentes. */
const MAX_DECIDEES = 12;

export function TableauDemandes({ cartes }: { cartes: CarteDemande[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vues, deplacerVue] = useOptimistic(cartes, (etat, geste: { id: string; statut: DemandeStatut }) =>
    etat.map((c) => (c.id === geste.id ? { ...c, statut: geste.statut } : c))
  );
  const [glisse, setGlisse] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [toutesDecidees, setToutesDecidees] = useState(false);

  function deposer(id: string, colonne: Colonne) {
    const carte = vues.find((c) => c.id === id);
    if (!carte || colonne.statuts.includes(carte.statut)) return;
    if (colonne.cle === "nouvelles") {
      setMessage("Une demande prise en charge ne redevient pas nouvelle.");
      return;
    }
    if (!colonne.cible) {
      // Une décision ne se prend pas d'un geste de la souris : on ouvre la
      // fiche, là où se trouvent le motif et le message au porteur.
      setMessage(`« ${carte.titre} » : la suite se décide sur sa fiche, avec un motif.`);
      router.push(`/demandes/${id}${carte.statut === "en_instruction" ? "#decision" : "#qualification"}`);
      return;
    }
    if (!["nouvelle", "en_accueil", "en_qualification", "en_attente_comite"].includes(carte.statut)) {
      setMessage("Cette demande a déjà sa suite. Pour la reprendre, rouvrez-la depuis sa fiche.");
      return;
    }
    const cible = colonne.cible;
    setMessage(undefined);
    startTransition(async () => {
      deplacerVue({ id, statut: cible });
      const r = await deplacerDemande(id, cible);
      if (r.error) setMessage(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {message && (
        <p role="status" className="rounded-md px-3 py-2 text-sm" style={{ background: "var(--color-surface-alt)", color: "#3b4452" }}>
          {message}
        </p>
      )}
      <div className="kanban-board" style={{ gridAutoColumns: "minmax(230px, 1fr)" }}>
        {COLONNES.map((col) => {
          let liste = vues.filter((c) => col.statuts.includes(c.statut));
          let masquees = 0;
          if (col.cle === "decidees") {
            liste = [...liste].sort((a, b) => (a.misAJour < b.misAJour ? 1 : -1));
            if (!toutesDecidees && liste.length > MAX_DECIDEES) {
              masquees = liste.length - MAX_DECIDEES;
              liste = liste.slice(0, MAX_DECIDEES);
            }
          }
          const accepte = !!col.cible;
          return (
            <section
              key={col.cle}
              aria-label={col.titre}
              className={`kanban-column${survol === col.cle ? " is-dragover" : ""}`}
              style={!accepte && glisse ? { opacity: 0.75 } : undefined}
              onDragOver={(e) => {
                if (!glisse) return;
                e.preventDefault();
                setSurvol(col.cle);
              }}
              onDragLeave={() => setSurvol((s) => (s === col.cle ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSurvol(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) deposer(id, col);
              }}
            >
              <div className="mb-2 px-1">
                <h2 className="text-sm font-bold">
                  {col.titre}{" "}
                  <span className="font-normal" style={{ color: "var(--color-muted)" }}>
                    {vues.filter((c) => col.statuts.includes(c.statut)).length}
                  </span>
                </h2>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {col.aide}
                </p>
              </div>

              {liste.map((c) => (
                <article
                  key={c.id}
                  className={`kanban-card${glisse === c.id ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    setGlisse(c.id);
                    e.dataTransfer.setData("text/plain", c.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setGlisse(null)}
                  style={{
                    borderColor: c.sansReponse ? "var(--color-danger)" : c.vote?.monAvisAttendu ? "var(--color-primary)" : undefined,
                  }}
                >
                  <Link href={`/demandes/${c.id}`} className="block text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    {c.titre}
                  </Link>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--color-muted)" }}>
                    {c.porteur}
                    {c.organisation ? ` · ${c.organisation}` : ""} · {PAYS_LABELS[c.pays]}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {col.cle === "decidees" && (
                      <span className="pastille" style={{ background: DEMANDE_STATUT_COLORS[c.statut], color: "#fff" }}>
                        {DEMANDE_STATUT_LABELS[c.statut]}
                      </span>
                    )}
                    {c.adn !== null && col.cle !== "decidees" && (
                      <span
                        className="pastille"
                        style={
                          c.adn
                            ? { background: "var(--color-success-soft)", color: "var(--color-success)" }
                            : { background: "#e9edf4", color: "#3b4452" }
                        }
                      >
                        {c.adn ? "ADN ✓" : "Hors ADN"}
                      </span>
                    )}
                    {c.vote && (
                      <span className="pastille" style={{ background: "#efeaff", color: "#5b4bb7" }}>
                        {c.vote.exprimes}/{c.vote.attendus} avis
                      </span>
                    )}
                    {c.voteClos && c.statut === "en_instruction" && (
                      <span className="pastille" style={{ background: "#fdf1dc", color: "#7a4a00" }}>
                        Décision à prononcer
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs" style={{ color: c.sansReponse ? "var(--color-danger)" : "var(--color-muted)", fontWeight: c.sansReponse ? 700 : 400 }}>
                    {c.sansReponse ? `Sans réponse depuis ${c.sansReponse} jours` : `Déposée ${c.anciennete}`}
                    {c.coach ? ` · suivie par ${c.coach}` : ""}
                  </p>

                  {c.vote?.monAvisAttendu && (
                    <Link href={`/demandes/${c.id}#consultation`} className="btn btn-primary mt-2 text-xs" style={{ minHeight: 34, padding: "0.3rem 0.75rem" }}>
                      Donner mon avis
                    </Link>
                  )}
                </article>
              ))}

              {!liste.length && (
                <p className="px-1 text-xs" style={{ color: "var(--color-muted)" }}>
                  {col.cible ? "Déposez une carte ici." : "Rien pour l'instant."}
                </p>
              )}
              {masquees > 0 && (
                <button type="button" onClick={() => setToutesDecidees(true)} className="w-full px-1 text-left text-xs font-semibold" style={{ color: "var(--color-primary)", minHeight: 32 }}>
                  Voir les {masquees} plus anciennes
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
