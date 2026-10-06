/**
 * Lecture des événements de l'agenda : dates à l'heure de Paris, regroupement
 * par mois, et ce qu'un champ de formulaire doit afficher pour les modifier.
 */

import type { Evenement } from "@/lib/types";

const FUSEAU = "Europe/Paris";

/** Le jour (AAAA-MM-JJ) et l'heure (HH:MM) d'un instant, vus de Paris. */
export function champsParis(iso: string): { jour: string; heure: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { jour: `${v("year")}-${v("month")}-${v("day")}`, heure: `${v("hour")}:${v("minute")}` };
}

function hm(iso: string) {
  return new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" })
    .replace(":", " h ")
    .replace(" h 00", " h")
    .replace(/^0/, "");
}

/** « mardi 14 octobre · 14 h – 17 h » ; sur plusieurs jours, les deux dates. */
export function quandEvenement(e: Pick<Evenement, "debut" | "fin">): string {
  const jour = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long" });
  if (!e.fin) return `${jour(e.debut)} · ${hm(e.debut)}`;
  const memeJour = champsParis(e.debut).jour === champsParis(e.fin).jour;
  return memeJour ? `${jour(e.debut)} · ${hm(e.debut)} – ${hm(e.fin)}` : `du ${jour(e.debut)} ${hm(e.debut)} au ${jour(e.fin)} ${hm(e.fin)}`;
}

/** Le pavé de date affiché à gauche d'un événement : « 14 » / « oct. ». */
export function paveDate(iso: string): { jour: string; mois: string } {
  const d = new Date(iso);
  return {
    jour: d.toLocaleDateString("fr-FR", { timeZone: FUSEAU, day: "numeric" }),
    mois: d.toLocaleDateString("fr-FR", { timeZone: FUSEAU, month: "short" }),
  };
}

/** « Octobre 2026 » : l'intitulé du mois d'un événement. */
export function moisDe(iso: string): string {
  const m = new Date(iso).toLocaleDateString("fr-FR", { timeZone: FUSEAU, month: "long", year: "numeric" });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Un événement est passé quand sa fin (ou, à défaut, son début + 2 h) l'est. */
export function estPasse(e: Pick<Evenement, "debut" | "fin">, maintenant: number): boolean {
  const fin = e.fin ? new Date(e.fin).getTime() : new Date(e.debut).getTime() + 2 * 3600_000;
  return fin < maintenant;
}

export function grouperParMois<T extends Pick<Evenement, "debut">>(evenements: T[]): { mois: string; liste: T[] }[] {
  const groupes: { mois: string; liste: T[] }[] = [];
  for (const e of evenements) {
    const mois = moisDe(e.debut);
    const dernier = groupes[groupes.length - 1];
    if (dernier?.mois === mois) dernier.liste.push(e);
    else groupes.push({ mois, liste: [e] });
  }
  return groupes;
}
