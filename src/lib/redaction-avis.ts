import type { VotePosition } from "@/lib/types";

// Ce module lit ANTHROPIC_API_KEY et ne doit jamais être importé par un
// composant client : il n'est appelé que depuis une server action.

/**
 * Rédaction du message adressé au porteur après l'instruction de sa demande.
 *
 * Pourquoi ce module existe
 * -------------------------
 * Les motifs de vote sont écrits entre professionnels, souvent en quelques mots
 * elliptiques. Transmis tels quels à la personne concernée, ils blessent
 * inutilement ou restent incompréhensibles. Il faut donc les reformuler — et
 * c'est un travail que personne n'a le temps de refaire à chaque dossier.
 *
 * Deux modes, et c'est délibéré
 * -----------------------------
 * 1. Avec une clé `ANTHROPIC_API_KEY` : le texte est rédigé par un modèle, à
 *    partir des avis exprimés.
 * 2. Sans clé : un brouillon est assemblé localement à partir des mêmes avis.
 *    Moins fluide, mais exploitable, et surtout : l'application fonctionne
 *    entièrement sans dépendance externe ni budget. Faire dépendre une étape
 *    du parcours d'un service tiers non configuré aurait bloqué la
 *    démonstration.
 *
 * Dans les deux cas, le texte produit est un BROUILLON. Il s'affiche dans un
 * champ modifiable et c'est un humain qui décide de ce qui part. Aucune
 * décision, aucun message n'est publié automatiquement.
 *
 * Données transmises
 * ------------------
 * Le titre du projet et les avis, rien d'autre. Ni nom, ni adresse, ni
 * téléphone, ni description complète : le strict nécessaire pour rédiger.
 */

export type AvisPourRedaction = {
  position: VotePosition;
  motif: string | null;
};

export type ContexteRedaction = {
  titreProjet: string;
  decision: "admise" | "non_retenue";
  avis: AvisPourRedaction[];
  absents: number;
};

export type ResultatRedaction = {
  texte: string;
  parIA: boolean;
};

const MODELE = "claude-sonnet-4-5";

function consigne(c: ContexteRedaction): string {
  const lignes = c.avis.map((a) => {
    const p =
      a.position === "favorable"
        ? "Favorable"
        : a.position === "defavorable"
        ? "Défavorable"
        : "Abstention";
    return `- ${p}${a.motif ? " : " + a.motif.trim() : " (sans commentaire)"}`;
  });

  return [
    "Tu rédiges, pour le compte d'ArcInnoLab, le message annonçant à une personne",
    "le résultat de l'instruction de sa candidature à un accompagnement.",
    "",
    "ArcInnoLab est un guichet transfrontalier franco-suisse d'accompagnement à",
    "l'innovation et aux transitions, financé par le programme Interreg.",
    "",
    `Projet candidat : « ${c.titreProjet} »`,
    `Décision : ${c.decision === "admise" ? "candidature retenue" : "candidature non retenue"}`,
    "",
    "Avis exprimés par les partenaires du consortium :",
    ...lignes,
    c.absents > 0
      ? `\n${c.absents} partenaire(s) ne se sont pas prononcés dans le délai imparti.`
      : "",
    "",
    "Consignes de rédaction :",
    "- Écris en français, à la deuxième personne du pluriel, sur un ton courtois et direct.",
    "- Entre 80 et 140 mots. Pas de titre, pas de formule d'appel, pas de signature :",
    "  le message est inséré dans une page qui porte déjà l'identité d'ArcInnoLab.",
    "- Restitue fidèlement le fond des avis, sans en inventer et sans les adoucir au",
    "  point de les rendre incompréhensibles. Une personne doit comprendre pourquoi.",
    "- N'attribue jamais un avis à une structure ou à une personne nommée.",
    c.decision === "non_retenue"
      ? "- Un refus n'est pas un jugement sur la valeur du projet : dis-le, et indique que\n  l'équipe reste disponible pour orienter vers d'autres dispositifs."
      : "- Indique qu'un coach référent prendra contact pour construire le parcours.",
    "",
    "Réponds uniquement par le texte du message.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Brouillon assemblé localement, sans service externe. */
function brouillonLocal(c: ContexteRedaction): string {
  const pour = c.avis.filter((a) => a.position === "favorable").length;
  const contre = c.avis.filter((a) => a.position === "defavorable").length;
  const abst = c.avis.filter((a) => a.position === "abstention").length;

  const motifs = c.avis
    .filter((a) => a.motif && a.motif.trim().length > 0)
    .map((a) => "— " + a.motif!.trim());

  const compte = [
    pour > 0 ? `${pour} avis favorable${pour > 1 ? "s" : ""}` : null,
    contre > 0 ? `${contre} avis défavorable${contre > 1 ? "s" : ""}` : null,
    abst > 0 ? `${abst} abstention${abst > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (c.decision === "admise") {
    return [
      `Votre candidature « ${c.titreProjet} » a été retenue par le consortium ArcInnoLab.`,
      "",
      `L'instruction a recueilli ${compte}.`,
      motifs.length ? "\nÉléments relevés par les partenaires :\n" + motifs.join("\n") : "",
      "",
      "Un coach référent va prendre contact avec vous pour construire votre parcours",
      "d'accompagnement et fixer les premiers jalons.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Votre candidature « ${c.titreProjet} » n'a pas été retenue pour cette promotion.`,
    "",
    `L'instruction a recueilli ${compte}${
      c.absents > 0 ? `, ${c.absents} partenaire(s) ne s'étant pas prononcés` : ""
    }.`,
    motifs.length ? "\nÉléments relevés par les partenaires :\n" + motifs.join("\n") : "",
    "",
    "Cette décision ne porte pas de jugement sur la valeur de votre projet : les places",
    "sont limitées et les critères tiennent à l'adéquation avec le programme.",
    "L'équipe reste disponible pour vous orienter vers d'autres dispositifs.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function redigerMessagePorteur(
  c: ContexteRedaction
): Promise<ResultatRedaction> {
  const cle = process.env.ANTHROPIC_API_KEY;

  if (!cle) {
    return { texte: brouillonLocal(c), parIA: false };
  }

  try {
    const reponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 700,
        messages: [{ role: "user", content: consigne(c) }],
      }),
      // Au-delà, l'utilisateur attend devant un écran figé : mieux vaut le
      // brouillon local tout de suite qu'une rédaction parfaite trop tard.
      signal: AbortSignal.timeout(20_000),
    });

    if (!reponse.ok) {
      return { texte: brouillonLocal(c), parIA: false };
    }

    const data = (await reponse.json()) as { content?: Array<{ text?: string }> };
    const texte = data.content?.map((b) => b.text ?? "").join("").trim();

    if (!texte) {
      return { texte: brouillonLocal(c), parIA: false };
    }

    return { texte, parIA: true };
  } catch {
    // Panne réseau, clé invalide, quota dépassé : on ne bloque jamais
    // l'instruction pour autant. Le brouillon local prend le relais.
    return { texte: brouillonLocal(c), parIA: false };
  }
}
