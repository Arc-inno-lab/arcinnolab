import Link from "next/link";

/**
 * Bandeau de conformité Interreg France-Suisse 2021-2027.
 *
 * Obligations couvertes (Guide de communication Interreg FR-CH 21-27, p. 2 et 5) :
 *  - le logo du programme figure sur TOUS les supports d'information du projet,
 *    internes et externes (p. 2) — donc sur chaque page de la plateforme ;
 *  - lien vers interreg-francesuisse.eu (p. 5) ;
 *  - nom du projet (p. 5) ;
 *  - mise en évidence du soutien financier (p. 5) ;
 *  - logos des autres co-financeurs (p. 5).
 *
 * Règles de tracé respectées :
 *  - logo couleur sur fond blanc, y compris au-dessus d'un fond sombre → le logo
 *    est toujours posé dans un rectangle blanc (p. 3) ;
 *  - aucune déformation : seule la hauteur est contrainte en CSS, la largeur suit (p. 3) ;
 *  - aucun filtre, aucune opacité, aucune désaturation appliquée au logo (p. 3) ;
 *  - l'emblème européen reste au moins aussi haut que le plus grand des autres
 *    logos affichés à côté (p. 4) — d'où la hauteur 72px du bloc programme face
 *    aux 22px des co-financeurs ;
 *  - alignement par le milieu et espacement généreux entre les blocs (p. 4).
 */
export function InterregFooter({ onDark = false }: { onDark?: boolean }) {
  return (
    <footer
      className={onDark ? "interreg-band interreg-band--onDark" : "interreg-band"}
      aria-label="Financement du projet"
    >
      <div className="interreg-logobox">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="interreg-logo"
          src="/brand/financeurs/interreg-france-suisse.png"
          alt="Interreg France – Suisse 2021-2027 — Cofinancé par l'Union Européenne"
        />
      </div>

      <div className="interreg-copy">
        <p>
          <strong>INTERLAB — ArcInnoLab</strong>, plateforme franco-suisse d&apos;accompagnement à
          l&apos;innovation et aux transitions, <strong>cofinancée par l&apos;Union européenne</strong>{" "}
          (FEDER) dans le cadre du programme Interreg France-Suisse 2021-2027, avec le soutien de la
          Confédération suisse et du Canton du Jura.
        </p>
        <p className="interreg-links">
          <a href="https://www.interreg-francesuisse.eu" target="_blank" rel="noopener noreferrer">
            interreg-francesuisse.eu
          </a>
          <span aria-hidden="true">·</span>
          <Link href="/a-propos">À propos du projet</Link>
        </p>
      </div>

      <div className="interreg-cofi">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/financeurs/canton-jura.png" alt="République et Canton du Jura" />
      </div>
    </footer>
  );
}
