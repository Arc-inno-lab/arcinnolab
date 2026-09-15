export type UserRole = "admin" | "partenaire" | "porteur";
export type ProjetEtat = "brouillon" | "soumis" | "valide" | "en_cours" | "archive";
export type InvitationStatut = "en_attente" | "acceptee" | "expiree" | "annulee";
export type InvitationRoleCible = "partenaire" | "porteur";

export interface Profile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  organisation: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role_cible: InvitationRoleCible;
  token: string;
  statut: InvitationStatut;
  date_envoi: string;
  date_expiration: string;
  id_emetteur: string;
  projet_id: string | null;
  nom: string | null;
  prenom: string | null;
  organisation: string | null;
}

export interface Projet {
  id: string;
  titre: string;
  description: string | null;
  etat: ProjetEtat;
  date_creation: string;
  id_partenaire_createur: string;
  logo_url: string | null;
}

export interface MembreProjet {
  id: string;
  projet_id: string;
  user_id: string;
  date_ajout: string;
  profile?: Pick<Profile, "nom" | "prenom" | "email" | "organisation" | "photo_url"> | null;
}

export type EtapeStatut = "a_faire" | "en_cours" | "validee" | "refusee";

export interface EtapeProjet {
  id: string;
  projet_id: string;
  titre: string;
  statut: EtapeStatut;
  ordre: number;
  avis: string | null;
  id_partenaire_validateur: string | null;
  date_validation: string | null;
  // Ajoutés en migration 016 : une colonne et un titre ne suffisent pas à
  // piloter un jalon, il faut pouvoir dire de quoi il s'agit et pour quand.
  description: string | null;
  date_echeance: string | null;
  updated_at: string;
}

export const ETAPE_STATUT_LABELS: Record<EtapeStatut, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  validee: "Validée",
  refusee: "Refusée",
};

export const ETAPE_STATUT_COLORS: Record<EtapeStatut, string> = {
  a_faire: "var(--color-muted)",
  en_cours: "var(--color-primary-2)",
  validee: "var(--color-success)",
  refusee: "var(--color-accent)",
};

export interface MessageProjet {
  id: string;
  projet_id: string;
  etape_id: string | null;
  auteur_id: string;
  contenu: string;
  created_at: string;
  auteur?: Pick<Profile, "nom" | "prenom" | "role" | "photo_url"> | null;
}

export interface DocumentProjet {
  id: string;
  projet_id: string;
  etape_id: string | null;
  type: string | null;
  nom_fichier: string;
  lien_fichier: string;
  date_upload: string;
  uploaded_by: string;
  uploader?: Pick<Profile, "nom" | "prenom"> | null;
}

export interface DirectMessage {
  id: string;
  expediteur_id: string;
  destinataire_id: string;
  contenu: string;
  date_envoi: string;
  lu: boolean;
}

export type NotificationType =
  | "etape_ajoutee"
  | "etape_statut"
  | "message_projet"
  | "message_etape"
  | "document_ajoute"
  | "invitation_acceptee"
  | "message_direct"
  // Émise par un trigger à chaque dépôt sur la page publique, pour tous les
  // admins et partenaires (cf. migration 012). Sans elle, une demande peut
  // rester invisible jusqu'à ce que quelqu'un pense à ouvrir la file.
  | "demande_accueil"
  // Ouverture d'une consultation : sans cette alerte, un partenaire n'a aucun
  // moyen d'apprendre qu'un avis lui est demandé (cf. migration 015).
  | "tour_vote"
  // Message écrit par un porteur depuis sa page de suivi.
  | "message_demande"
  // Ouverture automatique d'un projet à l'admission d'une candidature
  // (cf. migration 016).
  | "projet";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  titre: string;
  lien: string | null;
  lu: boolean;
  created_at: string;
}

// ── Accueil & orientation ───────────────────────────────────────────────────

export type Pays = "france" | "suisse";

export type Persona =
  | "innovation_sociale"
  | "startup_industrielle"
  | "dirigeant_pme_eti"
  | "intrapreneur_territorial"
  | "etudiant_entrepreneur"
  | "pme_familiale";

export type DemandeStatut =
  | "nouvelle"
  | "en_accueil"
  | "orientee"
  | "en_attente_comite"
  | "en_instruction"
  | "admise"
  | "non_retenue"
  | "close";

// ── Instruction collégiale ──────────────────────────────────────────────────

export type VotePosition = "favorable" | "defavorable" | "abstention";
export type TourStatut = "en_cours" | "complet" | "clos" | "abandonne";

export interface Vote {
  id: string;
  tour_id: string;
  votant_id: string;
  position: VotePosition;
  motif: string | null;
  created_at: string;
  updated_at: string;
  votant?: Pick<Profile, "nom" | "prenom" | "organisation" | "photo_url"> | null;
}

export interface TourVote {
  id: string;
  demande_id: string;
  promotion_id: string | null;
  ouvert_par: string | null;
  ouvert_le: string;
  date_limite: string;
  statut: TourStatut;
  clos_le: string | null;
  clos_par: string | null;
  votants_attendus: number;
  synthese: string | null;
  synthese_le: string | null;
  synthese_par_ia: boolean;
  created_at: string;
  votes?: Vote[];
}

export const VOTE_LABELS: Record<VotePosition, string> = {
  favorable: "Favorable",
  defavorable: "Défavorable",
  abstention: "Abstention",
};

export const VOTE_COLORS: Record<VotePosition, string> = {
  favorable: "var(--color-success)",
  defavorable: "var(--color-danger)",
  abstention: "var(--color-muted)",
};

export const TOUR_STATUT_LABELS: Record<TourStatut, string> = {
  en_cours: "Consultation en cours",
  complet: "Tous les avis sont rendus",
  clos: "Consultation close",
  abandonne: "Consultation abandonnée",
};

// ── Échanges avec le porteur ────────────────────────────────────────────────

export type AuteurMessage = "porteur" | "equipe";

export interface MessageDemande {
  id: string;
  demande_id: string;
  auteur: AuteurMessage;
  auteur_id: string | null;
  contenu: string;
  lu_par_equipe: boolean;
  lu_par_porteur: boolean;
  created_at: string;
  profil?: Pick<Profile, "nom" | "prenom" | "photo_url"> | null;
}

/** Ce que le porteur lit de son fil, via son jeton — sans identité d'équipe. */
export interface MessageSuivi {
  auteur: AuteurMessage;
  contenu: string;
  envoye_le: string;
}

export interface Reinitialisation {
  id: string;
  user_id: string;
  token: string;
  cree_par: string | null;
  created_at: string;
  expire_le: string;
  utilise_le: string | null;
}

export type OrientationIssue = "en_attente" | "contact_etabli" | "sans_suite";

export interface DemandeAccueil {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  organisation: string | null;
  pays: Pays;
  titre_projet: string;
  description: string;
  statut: DemandeStatut;
  persona: Persona | null;
  coach_id: string | null;
  notes_coach: string | null;
  promotion_id: string | null;
  projet_id: string | null;
  profil_cree_id: string | null;
  /** Message communiqué au porteur avec la décision, toujours relu par un humain. */
  message_porteur: string | null;
  created_at: string;
  updated_at: string;
  coach?: Pick<Profile, "nom" | "prenom" | "photo_url"> | null;
  orientations?: Orientation[];
}

export interface Orientation {
  id: string;
  demande_id: string;
  structure: string;
  motif: string | null;
  issue: OrientationIssue;
  date_relance: string | null;
  notes: string | null;
  cree_par: string | null;
  created_at: string;
}

export interface Promotion {
  id: string;
  nom: string;
  date_comite: string | null;
  ouverte: boolean;
  created_at: string;
}

export const PAYS_LABELS: Record<Pays, string> = {
  france: "France",
  suisse: "Suisse",
};

/**
 * Les six profils types du document « Persona ». Le libellé court sert aux
 * listes, la description sert au coach pendant le rendez-vous d'accueil : elle
 * lui rappelle ce que ce profil attend réellement du guichet.
 */
export const PERSONA_LABELS: Record<Persona, string> = {
  innovation_sociale: "Innovation sociale",
  startup_industrielle: "Start-up industrielle",
  dirigeant_pme_eti: "Dirigeant·e PME / ETI",
  intrapreneur_territorial: "Intrapreneur·e territorial·e",
  etudiant_entrepreneur: "Étudiant·e-entrepreneur·e",
  pme_familiale: "PME familiale",
};

export const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
  innovation_sociale:
    "Projet à impact, souvent non marchand : soin, handicap, low-tech. Cherche à légitimer une démarche que les dispositifs classiques évaluent mal, et co-conçoit avec les usagers.",
  startup_industrielle:
    "Production locale, réparabilité, open hardware. Cherche un accès industriel, du prototypage et un appui sur les normes.",
  dirigeant_pme_eti:
    "Porte un sujet de filière que personne ne veut financer seul. A surtout besoin d'être mis en relation avec ses pairs, rarement d'un accompagnement long.",
  intrapreneur_territorial:
    "Porte un projet qui n'est pas le sien, entre collectivité et tiers-lieu. Cherche un cadre et une légitimité plus qu'un financement.",
  etudiant_entrepreneur:
    "En idéation ou première preuve de concept. A besoin d'un mentor et d'un droit à l'erreur, pas d'un comité de sélection.",
  pme_familiale:
    "Entreprise établie, souvent en transmission. Veut des preuves que ça marche ailleurs avant de s'engager : le pair-à-pair convainc mieux qu'un argumentaire.",
};

export const DEMANDE_STATUT_LABELS: Record<DemandeStatut, string> = {
  nouvelle: "Nouvelle",
  en_accueil: "En accueil",
  orientee: "Orientée",
  en_attente_comite: "En attente du comité",
  en_instruction: "En instruction",
  admise: "Admise",
  non_retenue: "Non retenue",
  close: "Close",
};

export const DEMANDE_STATUT_COLORS: Record<DemandeStatut, string> = {
  nouvelle: "var(--color-accent)",
  en_accueil: "var(--color-primary-2)",
  orientee: "var(--color-success)",
  en_attente_comite: "var(--color-warning, #c98b1e)",
  en_instruction: "#7c5cbf",
  admise: "var(--color-primary)",
  non_retenue: "var(--color-muted)",
  close: "#8a8f98",
};

export const ORIENTATION_ISSUE_LABELS: Record<OrientationIssue, string> = {
  en_attente: "En attente de retour",
  contact_etabli: "Contact établi",
  sans_suite: "Sans suite",
};

/**
 * Les statuts depuis lesquels une demande est encore « vivante », c'est-à-dire
 * qu'elle attend une action de l'équipe. Sert à alimenter la file d'accueil :
 * une demande qui sort de cette liste a trouvé son issue.
 */
export const DEMANDE_STATUTS_ACTIFS: DemandeStatut[] = [
  "nouvelle",
  "en_accueil",
  "en_attente_comite",
  "en_instruction",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  partenaire: "Partenaire ArcInnoLab",
  porteur: "Porteur de projet",
};

export const ETAT_LABELS: Record<ProjetEtat, string> = {
  brouillon: "Brouillon",
  soumis: "Soumis",
  valide: "Validé",
  en_cours: "En cours",
  archive: "Archivé",
};

export const ETAT_COLORS: Record<ProjetEtat, string> = {
  brouillon: "var(--color-muted)",
  soumis: "var(--color-primary-2)",
  valide: "var(--color-success)",
  en_cours: "var(--color-primary)",
  archive: "#8a8f98",
};
