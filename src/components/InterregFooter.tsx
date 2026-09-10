import Link from "next/link";

/**
 * Conformité Interreg France-Suisse 2021-2027 — deux niveaux volontairement distincts.
 *
 * Décision produit (César, 10/09) : l'application est un outil opérationnel, pas un
 * support de communication. Le pavé complet encombrait chaque écran pour rien.
 *
 * Compromis retenu :
 *  - `InterregMention` : un rappel d'une seule ligne sur les écrans de travail. Le guide
 *    (p. 2) exige le logo sur « tous les supports d'information et de communication […]
 *    internes et externes » — le retirer complètement des écrans internes serait un pari.
 *    Le logo y est seul, donc la règle de hauteur relative (p. 4) ne s'applique pas :
 *    elle ne vaut que « si le logo du programme est positionné à côté d'autres logos ».
 *  - `InterregBlock` : le bloc complet exigé pour un site internet (p. 5) — logos du
 *    programme et des co-financeurs, lien vers interreg-francesuisse.eu, nom du projet,
 *    description avec objectif, résultats attendus et soutien financier. Porté par la
 *    seule page /a-propos, publique et donc capturable comme preuve de publicité (p. 8).
 *
 * Dans les deux cas : logo couleur sur fond blanc (p. 3), jamais filtré ni désaturé,
 * jamais déformé — seule la hauteur est contrainte en CSS, la largeur suit.
 */

const LOGO_ALT = "Interreg France – Suisse 2021-2027 — Cofinancé par l'Union Européenne";

export function InterregMention({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className={onDark ? "interreg-mention interreg-mention--onDark" : "interreg-mention"}>
      <span className="interreg-chip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/financeurs/interreg-france-suisse.png" alt={LOGO_ALT} />
      </span>
      <Link href="/a-propos">Projet cofinancé par l&apos;Union européenne</Link>
    </div>
  );
}

export function InterregBlock() {
  return (
    <footer className="interreg-band" aria-label="Financement du projet">
      <div className="interreg-logobox">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="interreg-logo" src="/brand/financeurs/interreg-france-suisse.png" alt={LOGO_ALT} />
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
        </p>
      </div>

      <div className="interreg-cofi">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/financeurs/canton-jura.png" alt="République et Canton du Jura" />
      </div>
    </footer>
  );
}
