/**
 * Lecture du parcours d'un projet : ce qui compte dans l'avancement, ce qui
 * est en retard, ce qui vient ensuite. Partagé entre la vue de l'équipe (le
 * tableau) et celle du porteur (la liste), pour qu'ils disent la même chose.
 */

import type { ColonneProjet, EtapeProjet } from "@/lib/types";

const FUSEAU = "Europe/Paris";

/** Préfixe des messages qui signalent un document joint depuis la messagerie. */
export const PREFIXE_DOCUMENT = "Document déposé : ";

/** Aujourd'hui à minuit, en date ISO courte (AAAA-MM-JJ), heure de Paris. */
export function aujourdhuiIso(instant: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

/**
 * Convertit un jour et une heure saisis à Paris en instant UTC. Le serveur
 * tourne en UTC : sans cette conversion, un rendez-vous pris à 14 h
 * s'afficherait à 16 h l'été.
 */
export function versInstantParis(jour: string, heure: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !/^\d{2}:\d{2}$/.test(heure)) return null;
  const naif = new Date(`${jour}T${heure}:00Z`);
  if (Number.isNaN(naif.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSEAU,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(naif);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const vuDeParis = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"));
  const decalage = vuDeParis - naif.getTime();
  return new Date(naif.getTime() - decalage).toISOString();
}

export function jourLong(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: FUSEAU,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function jourCourt(isoOuDate: string): string {
  const d = isoOuDate.length === 10 ? new Date(`${isoOuDate}T12:00:00Z`) : new Date(isoOuDate);
  return d.toLocaleDateString("fr-FR", { timeZone: FUSEAU, day: "numeric", month: "long" });
}

export function heure(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" })
    .replace(":", " h ")
    .replace(" h 00", " h");
}

/** Les éléments qui comptent dans l'avancement : tout sauf les rendez-vous. */
export function travaux(etapes: EtapeProjet[]) {
  return etapes.filter((e) => e.type !== "rendez_vous");
}

export function estFaite(e: EtapeProjet, terminales: Set<string>) {
  return e.validation === "validee" || (e.colonne_id ? terminales.has(e.colonne_id) : false);
}

export function estEnRetard(e: EtapeProjet, terminales: Set<string>, aujourdhui: string) {
  return (
    e.type !== "rendez_vous" &&
    !!e.date_echeance &&
    !estFaite(e, terminales) &&
    e.date_echeance < aujourdhui
  );
}

export type LectureParcours = {
  terminales: Set<string>;
  total: number;
  validees: number;
  aValider: number;
  enRetard: number;
  prochaine: EtapeProjet | null;
  prochainRdv: EtapeProjet | null;
};

/**
 * Tout ce qu'un écran a besoin de savoir d'un parcours, calculé une fois.
 * `instant` est passé en paramètre plutôt que lu ici : lire l'heure pendant le
 * rendu rend l'affichage instable, et React l'interdit à juste titre.
 */
export function lireParcours(
  etapes: EtapeProjet[],
  colonnes: ColonneProjet[],
  instant: number
): LectureParcours {
  const terminales = new Set(colonnes.filter((c) => c.terminale).map((c) => c.id));
  const aujourdhui = aujourdhuiIso(instant);
  const rangColonne = new Map(colonnes.map((c) => [c.id, c.ordre]));
  const liste = travaux(etapes);

  // « À faire maintenant » : ce qui n'est pas fait, le plus avancé d'abord
  // (une étape en cours passe avant une étape pas commencée), puis la plus
  // pressée.
  const restantes = liste
    .filter((e) => !estFaite(e, terminales))
    .sort((a, b) => {
      const ra = a.colonne_id ? (rangColonne.get(a.colonne_id) ?? 0) : 0;
      const rb = b.colonne_id ? (rangColonne.get(b.colonne_id) ?? 0) : 0;
      if (ra !== rb) return rb - ra;
      const da = a.date_echeance ?? "9999-12-31";
      const db = b.date_echeance ?? "9999-12-31";
      if (da !== db) return da < db ? -1 : 1;
      return a.ordre - b.ordre;
    });

  const rdvs = etapes
    .filter(
      (e) =>
        e.type === "rendez_vous" &&
        e.rdv_debut &&
        e.rdv_statut !== "annule" &&
        new Date(e.rdv_debut).getTime() >= instant - 2 * 3600_000
    )
    .sort((a, b) => (a.rdv_debut! < b.rdv_debut! ? -1 : 1));

  return {
    terminales,
    total: liste.length,
    validees: liste.filter((e) => e.validation === "validee").length,
    aValider: liste.filter((e) => e.validation === "a_valider").length,
    enRetard: liste.filter((e) => estEnRetard(e, terminales, aujourdhui)).length,
    prochaine: restantes[0] ?? null,
    prochainRdv: rdvs[0] ?? null,
  };
}

/** L'ordre de lecture du parcours pour le porteur : chronologique, simple. */
export function ordreParcours(etapes: EtapeProjet[], terminales: Set<string>) {
  const cle = (e: EtapeProjet) => {
    if (e.type === "rendez_vous") return e.rdv_debut?.slice(0, 10) ?? "9999-12-31";
    if (e.validation === "validee") return "0000-00-00" + (e.date_validation ?? "");
    if (estFaite(e, terminales)) return "0000-00-01";
    return e.date_echeance ?? "9999-12-30";
  };
  return [...etapes].sort((a, b) => {
    const ka = cle(a);
    const kb = cle(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.ordre - b.ordre;
  });
}
