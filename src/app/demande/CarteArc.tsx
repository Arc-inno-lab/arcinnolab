import { FOND_CARTE } from "./fond-carte";

type Cle = keyof typeof FOND_CARTE.villes;

/** Les lieux du réseau, et ce qu'on y trouve. */
const LIEUX: { cle: Cle; qui: string; cote: "g" | "d" }[] = [
  { cle: "mulhouse", qui: "KMØ", cote: "g" },
  { cle: "belfort", qui: "UTBM · Crunchlab", cote: "g" },
  { cle: "bale", qui: "Basel Area", cote: "d" },
  { cle: "delemont", qui: "Ville de Delémont · SAFED", cote: "d" },
  { cle: "neuchatel", qui: "Haute École Arc", cote: "d" },
];

/** Les liens du réseau entre les lieux, dessinés comme ceux du logo. */
const LIENS: [Cle, Cle][] = [
  ["belfort", "mulhouse"],
  ["mulhouse", "bale"],
  ["bale", "delemont"],
  ["delemont", "belfort"],
  ["delemont", "neuchatel"],
  ["belfort", "neuchatel"],
];

/**
 * La carte de l'Arc jurassien, de Mulhouse à Neuchâtel : la France en bleu,
 * la Suisse en rouge, l'Allemagne en gris, et le réseau ArcInnoLab qui relie
 * les cinq lieux par-dessus la frontière.
 */
export function CarteArc() {
  const { largeur: W, hauteur: H, pays, villes } = FOND_CARTE;
  const pos = (k: Cle) => ({ x: (villes[k].x / 100) * W, y: (villes[k].y / 100) * H });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="carte-titre">
      <title id="carte-titre">
        Carte de l&apos;Arc jurassien : Mulhouse, Belfort et Bâle au nord, Delémont et Neuchâtel en Suisse
      </title>
      <rect width={W} height={H} fill="#f6f9fd" />
      <path d={pays.de} fill="#eceef2" stroke="#fff" strokeWidth="4" />
      <path d={pays.fr} fill="#dce7f7" stroke="#fff" strokeWidth="4" />
      <path d={pays.ch} fill="#f7dcdc" stroke="#fff" strokeWidth="4" />

      <g fontFamily="inherit" fontWeight="800" letterSpacing="6" fontSize="30" opacity="0.55">
        <text x={W * 0.08} y={H * 0.12} fill="#2f5fae">FRANCE</text>
        <text x={W * 0.62} y={H * 0.74} fill="#c8242a">SUISSE</text>
        <text x={W * 0.74} y={H * 0.12} fill="#8a8f98">ALLEMAGNE</text>
      </g>

      <g fill="none" stroke="#2f7fd1" strokeWidth="4" strokeLinecap="round" opacity="0.55">
        {LIENS.map(([a, b], i) => {
          const p = pos(a);
          const q = pos(b);
          const mx = (p.x + q.x) / 2 + (i % 2 ? 40 : -40);
          const my = (p.y + q.y) / 2 + (i % 2 ? -30 : 30);
          return <path key={`${a}-${b}`} d={`M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}`} />;
        })}
      </g>

      {LIEUX.map(({ cle, qui, cote }) => {
        const { x, y } = pos(cle);
        const dx = cote === "g" ? -22 : 22;
        const ancre = cote === "g" ? "end" : "start";
        return (
          <g key={cle}>
            <circle cx={x} cy={y} r="22" fill="#c8242a" opacity="0.18" />
            <circle cx={x} cy={y} r="11" fill="#c8242a" stroke="#fff" strokeWidth="4" />
            <text x={x + dx} y={y - 4} textAnchor={ancre} fontSize="30" fontWeight="800" fill="#183d7a" stroke="#f6f9fd" strokeWidth="8" paintOrder="stroke">
              {villes[cle].nom}
            </text>
            <text x={x + dx} y={y + 28} textAnchor={ancre} fontSize="22" fontWeight="600" fill="#3b4452" stroke="#f6f9fd" strokeWidth="7" paintOrder="stroke">
              {qui}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
