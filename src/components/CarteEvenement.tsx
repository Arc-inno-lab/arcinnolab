import type { Evenement } from "@/lib/types";
import { paveDate, quandEvenement } from "@/lib/agenda";

/**
 * Un événement de l'agenda, tel qu'on le lit partout : dans l'appli, sur la
 * vitrine, dans l'espace du porteur. La date d'abord, en gros : c'est la
 * première chose qu'on cherche.
 */
export function CarteEvenement({
  evenement: e,
  montrerVisibilite = false,
  grand = false,
  passe = false,
  children,
}: {
  evenement: Evenement;
  /** Affiche « Réservé aux membres » sur les événements non publics (vue interne). */
  montrerVisibilite?: boolean;
  /** Texte plus grand (espace porteur, vitrine). */
  grand?: boolean;
  /** Événement terminé : pas de bouton « Ajouter à mon agenda ». */
  passe?: boolean;
  /** Boutons de gestion, pour l'équipe. */
  children?: React.ReactNode;
}) {
  const pave = paveDate(e.debut);
  const longue = (e.description?.length ?? 0) > 280;

  return (
    <article className="card flex gap-4 p-4" style={e.annule ? { opacity: 0.75 } : undefined}>
      <div
        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-center"
        style={{ background: e.annule ? "#eef1f6" : "var(--color-primary-soft)", color: "var(--color-primary)" }}
        aria-hidden="true"
      >
        <span className="text-2xl font-bold leading-none">{pave.jour}</span>
        <span className="text-xs font-semibold uppercase">{pave.mois}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`${grand ? "text-[18px]" : "text-base"} font-bold`} style={e.annule ? { textDecoration: "line-through" } : undefined}>
            {e.titre}
          </h3>
          {e.annule && (
            <span className="pastille" style={{ background: "var(--color-danger)", color: "#fff" }}>
              Annulé
            </span>
          )}
          {montrerVisibilite && !e.public && (
            <span className="pastille" style={{ background: "#efeaff", color: "#5b4bb7" }}>
              Réservé aux membres
            </span>
          )}
        </div>
        <p className={`${grand ? "text-[16px]" : "text-sm"} mt-0.5 font-medium`} style={{ color: "#3b4452" }}>
          {quandEvenement(e)}
        </p>
        {(e.lieu || e.organisateur) && (
          <p className={`${grand ? "text-[15px]" : "text-sm"}`} style={{ color: "var(--color-muted)" }}>
            {[e.lieu, e.organisateur ? `organisé par ${e.organisateur}` : null].filter(Boolean).join(" · ")}
          </p>
        )}

        {e.description &&
          (longue ? (
            <details className="mt-2">
              <summary className={`${grand ? "text-[15px]" : "text-sm"} cursor-pointer`} style={{ color: "var(--color-primary)" }}>
                {e.description.slice(0, 200).trimEnd()}… <span className="font-semibold">lire la suite</span>
              </summary>
              <p className={`${grand ? "text-[16px]" : "text-sm"} mt-2 whitespace-pre-wrap`}>{e.description}</p>
            </details>
          ) : (
            <p className={`${grand ? "text-[16px]" : "text-sm"} mt-2 whitespace-pre-wrap`}>{e.description}</p>
          ))}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!e.annule && !passe && (
            <a href={`/evenements/${e.id}/ics`} className="btn btn-outline text-sm" style={{ minHeight: 38 }}>
              Ajouter à mon agenda
            </a>
          )}
          {e.lien && (
            <a href={e.lien} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-sm" style={{ minHeight: 38 }}>
              En savoir plus ↗
            </a>
          )}
          {children}
        </div>
      </div>
    </article>
  );
}
