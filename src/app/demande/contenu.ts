/**
 * Le contenu éditorial de la vitrine, tiré des supports officiels
 * (manifeste, affiche A3, flyer, carte des partenaires et services).
 * Regroupé ici pour pouvoir le relire et le corriger sans toucher à la mise
 * en page.
 */

export const PUBLICS = ["Citoyens", "Étudiants", "Associations", "Entreprises", "Industries", "Collectivités"];

export const DOMAINES = [
  "Technologies de pointe",
  "Mobilité",
  "Industrie du futur",
  "Énergie",
  "Recyclage des matériaux",
  "Gestion durable des déchets",
];

export const CHIFFRES = [
  { valeur: "5", libelle: "partenaires fondateurs" },
  { valeur: "2", libelle: "pays, un seul territoire" },
  { valeur: "4", libelle: "lieux d'accueil" },
  { valeur: "1", libelle: "guichet unique" },
];

export const CONVICTIONS = [
  {
    titre: "Le constat",
    texte:
      "Les idées et les talents existent. Mais entre la multiplicité des dispositifs, des aides et des interlocuteurs, beaucoup de porteurs de projets se perdent avant même d'agir.",
  },
  {
    titre: "Notre réponse",
    texte:
      "Un point d'entrée unique, de part et d'autre de la frontière. Nous ne remplaçons pas les structures existantes : nous créons des ponts et vous orientons vers la bonne ressource, au bon moment.",
  },
  {
    titre: "Notre ambition",
    texte:
      "Devenir le catalyseur de la Transition dans l'espace transfrontalier, et transformer l'énergie des innovateurs en réussites concrètes pour nos territoires.",
  },
];

export const ETAPES = [
  {
    titre: "Vous nous parlez de votre projet",
    texte: "Trois minutes, sans créer de compte. Vous recevez aussitôt un lien pour suivre votre demande.",
  },
  {
    titre: "Un premier échange",
    texte: "Un membre de l'équipe vous contacte pour comprendre votre projet et vos vrais besoins.",
  },
  {
    titre: "La bonne orientation",
    texte:
      "Mise en relation avec le partenaire, l'expert ou le financement adapté — ou candidature à une promotion d'accompagnement ArcInnoLab.",
  },
  {
    titre: "Un accompagnement sur mesure",
    texte: "Un accompagnateur, des étapes claires et des rendez-vous réguliers, dans votre espace projet.",
  },
];

export type Solution = { titre: string; icone: string };

export const SOLUTIONS: Solution[] = [
  { titre: "Acculturation & sensibilisation", icone: "ampoule" },
  { titre: "Challenges d'innovation & ateliers participatifs", icone: "atelier" },
  { titre: "Conseil, études & développement", icone: "conseil" },
  { titre: "Matérialisation & prototypage", icone: "proto" },
  { titre: "Formations", icone: "formation" },
  { titre: "Mise en réseau & facilitation", icone: "reseau" },
  { titre: "Mise à disposition d'espaces", icone: "espace" },
  { titre: "Prospective & veille", icone: "veille" },
];

export const AVANTAGES = [
  { titre: "Visibilité", texte: "Pitchs, expositions itinérantes, plateforme numérique." },
  { titre: "Réseau", texte: "Partenaires, financeurs, experts, porteurs de projets." },
  { titre: "Lieux", texte: "Bureaux, salles de réunion, fablabs, laboratoires d'usage." },
  { titre: "Événements", texte: "Challenges, conférences, workshops." },
  { titre: "Accompagnement", texte: "Collaboration étudiante, expertise, coaching." },
  { titre: "Observatoire", texte: "Données stratégiques, veille, prospective." },
  { titre: "Formations", texte: "Fresques, formations pratiques et avancées." },
];

export type Partenaire = {
  nom: string;
  lieu: string;
  pays: "France" | "Suisse";
  logos: { src: string; alt: string }[];
  thematiques: string[];
  services: string[];
};

export const PARTENAIRES: Partenaire[] = [
  {
    nom: "UTBM · Crunchlab",
    lieu: "Belfort — Techn'Hom",
    pays: "France",
    logos: [
      { src: "/brand/vitrine/logos/utbm.png", alt: "UTBM" },
      { src: "/brand/vitrine/logos/crunchlab.png", alt: "UTBM Innovation Crunchlab" },
    ],
    thematiques: ["Informatique", "Énergie", "Mobilités du futur", "Industrie 4.0"],
    services: ["Crunch Time", "Design thinking", "Prototypage", "Hébergement", "Formation continue", "Coworking"],
  },
  {
    nom: "KMØ",
    lieu: "Mulhouse",
    pays: "France",
    logos: [{ src: "/brand/vitrine/logos/km0.png", alt: "KMØ" }],
    thematiques: ["Industrie", "Innovation", "Numérique"],
    services: ["Open Lab IA", "Hébergement d'entreprises et de startups", "Centres de formation", "Club des locomotives"],
  },
  {
    nom: "Basel Area",
    lieu: "Bâle — Switzerland Innovation Park, site Jura",
    pays: "Suisse",
    logos: [{ src: "/brand/vitrine/logos/basel-area.png", alt: "Basel Area" }],
    thematiques: ["Production", "Medtech", "TIC", "Digitalisation", "Sciences de la vie", "Foodtech"],
    services: ["Événements", "Groupes de travail", "Coworking", "Accompagnement individuel et collectif"],
  },
  {
    nom: "Ville de Delémont",
    lieu: "Delémont — Gare Sud · SAFED",
    pays: "Suisse",
    logos: [{ src: "/brand/vitrine/logos/delemont.png", alt: "Ville de Delémont" }],
    thematiques: ["Innovation", "Économie circulaire"],
    services: ["Fête de la Transition", "Coworking", "Hébergement d'entreprises et d'associations"],
  },
  {
    nom: "Haute École Arc",
    lieu: "Neuchâtel · Berne · Jura",
    pays: "Suisse",
    logos: [{ src: "/brand/vitrine/logos/he-arc.png", alt: "Haute École Arc" }],
    thematiques: ["Digitalisation", "Technologies de précision", "Microtechnologies", "Éco-conception"],
    services: ["Challenge InnoCité", "Formation continue", "Partenariats industriels", "Accompagnement des territoires"],
  },
];

export const PHOTOS = [
  { src: "/brand/vitrine/photos/photo-03.webp", alt: "Atelier de prototypage avec imprimante 3D" },
  { src: "/brand/vitrine/photos/photo-06.webp", alt: "Façade du Crunchlab à Belfort" },
  { src: "/brand/vitrine/photos/photo-09.webp", alt: "Étudiants travaillant sur un prototype électronique" },
  { src: "/brand/vitrine/photos/photo-04.webp", alt: "Bâtiment en brique du KMØ à Mulhouse" },
  { src: "/brand/vitrine/photos/photo-02.webp", alt: "Campus de la Haute École Arc" },
  { src: "/brand/vitrine/photos/photo-08.webp", alt: "Espace de travail partagé lumineux" },
  { src: "/brand/vitrine/photos/photo-10.webp", alt: "Vue aérienne de Delémont" },
  { src: "/brand/vitrine/photos/photo-01.webp", alt: "Cubes en bois aux pictogrammes de l'écologie" },
  { src: "/brand/vitrine/photos/photo-05.webp", alt: "Porteuse de projet devant un écran « Startup »" },
  { src: "/brand/vitrine/photos/photo-07.webp", alt: "Illustration de la créativité : ampoule, fusée, engrenages" },
];

export const FINANCEMENT =
  "Ce projet est soutenu par le programme de coopération territoriale européenne Interreg France-Suisse 2021-2027. Il bénéficie à ce titre du Fonds européen de développement régional (FEDER) à hauteur de 343 065 €, de fonds fédéraux à hauteur de 376 411 € et de fonds cantonaux suisses (Canton du Jura) pour un montant de 376 411 €.";

export const CONTACT_EMAIL = "arcinnolab@gmail.com";
export const LINKEDIN = "https://www.linkedin.com/showcase/arcinnolab";
