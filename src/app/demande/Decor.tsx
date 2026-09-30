/**
 * Éléments graphiques de la vitrine, dessinés en SVG : le réseau de nœuds
 * reprend le motif du logo (des points reliés, bleus et rouges), et les
 * pictogrammes des solutions restent légers et nets à toute taille.
 */

/** Le motif « réseau » du logo, en grand, en arrière-plan du haut de page. */
export function Reseau({ className = "" }: { className?: string }) {
  const noeuds: [number, number, number, "b" | "r" | "c"][] = [
    [60, 80, 7, "b"], [170, 40, 5, "c"], [250, 130, 9, "r"], [120, 200, 6, "b"], [330, 60, 6, "b"],
    [400, 170, 10, "b"], [300, 250, 5, "c"], [470, 90, 5, "r"], [520, 230, 7, "b"], [210, 310, 8, "b"],
    [420, 330, 6, "r"], [560, 360, 9, "b"], [90, 360, 5, "c"], [350, 420, 7, "b"], [500, 470, 5, "c"],
    [620, 150, 6, "b"], [640, 300, 5, "r"],
  ];
  const liens: [number, number][] = [
    [0, 1], [1, 2], [0, 3], [2, 3], [2, 4], [4, 5], [2, 6], [5, 6], [4, 7], [5, 8], [6, 9], [3, 9],
    [9, 10], [8, 10], [8, 11], [10, 11], [3, 12], [9, 13], [10, 13], [11, 14], [13, 14], [7, 15], [8, 15], [11, 16], [15, 16],
  ];
  const couleur = { b: "#2f7fd1", r: "#c8242a", c: "#58b6e6" };
  return (
    <svg viewBox="0 0 680 520" className={className} aria-hidden="true" focusable="false">
      <g stroke="#2f7fd1" strokeOpacity="0.28" strokeWidth="2" fill="none">
        {liens.map(([a, b], i) => {
          const [x1, y1] = noeuds[a];
          const [x2, y2] = noeuds[b];
          const mx = (x1 + x2) / 2 + (i % 2 ? 18 : -18);
          const my = (y1 + y2) / 2 + (i % 3 ? -14 : 14);
          return <path key={i} d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} />;
        })}
      </g>
      {noeuds.map(([x, y, r, c], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={couleur[c]} fillOpacity={c === "c" ? 0.7 : 0.9} />
      ))}
    </svg>
  );
}

const TRAITS: Record<string, React.ReactNode> = {
  ampoule: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </>
  ),
  atelier: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" />
    </>
  ),
  conseil: (
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      <path d="M8.5 12h7M8.5 9h4" />
    </>
  ),
  proto: (
    <>
      <path d="M4 20h16M6 20V9h12v11" />
      <path d="M9 9V5h6v4M10 14h4" />
    </>
  ),
  formation: (
    <>
      <path d="m2 9 10-5 10 5-10 5-10-5Z" />
      <path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    </>
  ),
  reseau: (
    <>
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M7.3 7.2 10.5 16M16.7 7.2 13.5 16M7.5 6h9" />
    </>
  ),
  espace: (
    <>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  veille: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M8 11h6M11 8v6" />
    </>
  ),
};

export function Pictogramme({ nom, taille = 24 }: { nom: string; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRAITS[nom]}
    </svg>
  );
}
