/**
 * Le logo ArcInnoLab, recadré au plus près du dessin (l'original a de larges
 * marges blanches qui le faisaient paraître minuscule).
 *
 * - `petit` : barres d'en-tête sur téléphone
 * - `moyen` : pages de connexion, de suivi…
 * - `grand` : pages d'accueil publiques
 * - `menu`  : menu latéral, toute la largeur sur grand écran
 */
const TAILLES = {
  petit: "h-14 w-auto",
  moyen: "h-24 w-auto",
  grand: "h-28 w-auto md:h-36",
  menu: "h-14 w-auto md:h-auto md:w-full md:max-w-[11.5rem]",
} as const;

export function Logo({ taille = "moyen" }: { taille?: keyof typeof TAILLES }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo-arcinnolab-serre.svg" alt="ArcInnoLab" className={`block ${TAILLES[taille]}`} />
  );
}
