/**
 * Fabrication des fichiers .ics (« Ajouter à mon agenda ») : un format que
 * tous les agendas savent ouvrir, téléphone, Outlook ou Google.
 */

export function horodatageIcs(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Échappement imposé par la RFC 5545 pour les champs texte. */
export function texteIcs(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Les lignes de plus de 75 octets doivent être repliées (RFC 5545, 3.1). */
export function replierIcs(ligne: string) {
  const morceaux: string[] = [];
  let reste = ligne;
  while (new TextEncoder().encode(reste).length > 73) {
    let n = 73;
    while (new TextEncoder().encode(reste.slice(0, n)).length > 73) n--;
    morceaux.push(reste.slice(0, n));
    reste = reste.slice(n);
  }
  morceaux.push(reste);
  return morceaux.join("\r\n ");
}

export function reponseIcs(lignes: string[], nomFichier: string, prive: boolean) {
  return new Response(lignes.map(replierIcs).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": prive ? "private, no-store" : "public, max-age=300",
    },
  });
}
