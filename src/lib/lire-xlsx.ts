import { unzipSync, strFromU8 } from "fflate";

/**
 * Lit un classeur Excel (.xlsx) et renvoie les lignes d'un onglet, cellule par
 * cellule, en texte. Pas de formules ni de mise en forme : juste ce qui est
 * écrit. Un .xlsx n'est qu'une archive zip de fichiers XML ; on n'en lit que
 * trois (le classeur, les textes partagés, l'onglet voulu).
 *
 * L'onglet « Comptes » du modèle est pris s'il existe, sinon le premier.
 */
export function lireTableur(octets: Uint8Array, ongletPrefere = "Comptes"): string[][] {
  const zip = unzipSync(octets, {
    filter: (f) =>
      f.name === "xl/workbook.xml" ||
      f.name === "xl/_rels/workbook.xml.rels" ||
      f.name === "xl/sharedStrings.xml" ||
      f.name.startsWith("xl/worksheets/sheet"),
  });
  const lire = (nom: string) => (zip[nom] ? strFromU8(zip[nom]) : "");

  const classeur = lire("xl/workbook.xml");
  if (!classeur) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).");

  // Onglets : nom → identifiant de relation → fichier XML.
  const onglets = [...classeur.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    nom: decoder(attribut(m[0], "name") ?? ""),
    rel: attribut(m[0], "r:id") ?? "",
  }));
  const rels = new Map(
    [...lire("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      attribut(m[0], "Id") ?? "",
      (attribut(m[0], "Target") ?? "").replace(/^\/?xl\//, "").replace(/^\//, ""),
    ])
  );
  const choisi = onglets.find((o) => o.nom.toLowerCase() === ongletPrefere.toLowerCase()) ?? onglets[0];
  const cible = choisi ? rels.get(choisi.rel) : undefined;
  const feuille = lire(cible ? `xl/${cible}` : "xl/worksheets/sheet1.xml");
  if (!feuille) throw new Error("Onglet introuvable dans le classeur.");

  // Textes partagés : une entrée <si> par texte, éventuellement en plusieurs morceaux <t>.
  const partages = [...lire("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decoder(t[1])).join("")
  );

  const lignes: string[][] = [];
  for (const r of feuille.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const ligne: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const contenu = c[2] ?? "";
      const ref = attribut(`<c ${attrs}>`, "r") ?? "";
      const col = colonne(ref.replace(/\d+$/, ""));
      const type = attribut(`<c ${attrs}>`, "t");
      let valeur = "";
      if (type === "s") {
        const v = contenu.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        valeur = v !== undefined ? partages[Number(v)] ?? "" : "";
      } else if (type === "inlineStr") {
        valeur = [...contenu.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decoder(t[1])).join("");
      } else {
        valeur = decoder(contenu.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      }
      if (col >= 0) ligne[col] = valeur.trim();
    }
    const complete = Array.from(ligne, (v) => v ?? "");
    if (complete.some(Boolean)) lignes.push(complete);
  }
  return lignes;
}

function attribut(balise: string, nom: string): string | undefined {
  const m = balise.match(new RegExp(`\\s${nom.replace(":", "\\:")}="([^"]*)"`));
  return m?.[1];
}

function colonne(lettres: string): number {
  if (!lettres) return -1;
  let n = 0;
  for (const ch of lettres.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function decoder(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}
