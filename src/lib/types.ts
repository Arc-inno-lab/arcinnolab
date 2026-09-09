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
}

export interface Projet {
  id: string;
  titre: string;
  description: string | null;
  etat: ProjetEtat;
  date_creation: string;
  id_partenaire_createur: string;
}

export interface MembreProjet {
  id: string;
  projet_id: string;
  user_id: string;
  date_ajout: string;
  profile?: Pick<Profile, "nom" | "prenom" | "email" | "organisation"> | null;
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
