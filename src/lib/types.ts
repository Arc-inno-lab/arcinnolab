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
  | "message_direct";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  titre: string;
  lien: string | null;
  lu: boolean;
  created_at: string;
}

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
