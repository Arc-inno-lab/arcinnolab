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
