/**
 * Ce que le porteur avait écrit et échangé avant l'admission de son projet :
 * sa demande, les messages de sa page de suivi, les documents joints. Sans ce
 * rappel, l'admission coupait le fil — tout recommençait de zéro dans
 * l'espace projet.
 */

export type LigneHistorique = {
  genre: "demande" | "message" | "document";
  auteur: string;
  contenu: string;
  quand: string;
  url?: string | null;
  taille?: number | null;
};

function tailleLisible(octets: number) {
  return octets >= 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

export function HistoriqueDemande({ lignes, grand = false }: { lignes: LigneHistorique[]; grand?: boolean }) {
  if (!lignes.length) return null;
  const demande = lignes.find((l) => l.genre === "demande");
  const messages = lignes.filter((l) => l.genre === "message");
  const documents = lignes.filter((l) => l.genre === "document");
  const t = grand ? "text-[16px]" : "text-sm";

  return (
    <details className="card p-5">
      <summary className={`cursor-pointer font-bold ${grand ? "text-[18px]" : "text-base"}`}>
        Avant l&apos;admission : la demande d&apos;origine
        <span className="ml-2 font-normal" style={{ color: "var(--color-muted)" }}>
          ({messages.length} message{messages.length > 1 ? "s" : ""}, {documents.length} document{documents.length > 1 ? "s" : ""})
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        {demande && (
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-muted)" }}>
              Demande déposée le {demande.quand}
            </p>
            <p className={`${t} mt-1 whitespace-pre-wrap`}>{demande.contenu}</p>
          </div>
        )}
        {documents.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-muted)" }}>
              Documents joints
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {documents.map((d, i) => (
                <li key={i} className={t}>
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                      {d.contenu}
                    </a>
                  ) : (
                    <span className="font-semibold">{d.contenu}</span>
                  )}{" "}
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {d.taille ? `${tailleLisible(d.taille)} · ` : ""}
                    {d.quand}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: "var(--color-muted)" }}>
              Échanges sur la page de suivi
            </p>
            <ul className="mt-1 flex flex-col gap-2">
              {messages.map((m, i) => (
                <li key={i} className={t}>
                  <span className="font-semibold">{m.auteur}</span>{" "}
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    · {m.quand}
                  </span>
                  <p className="whitespace-pre-wrap">{m.contenu}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
