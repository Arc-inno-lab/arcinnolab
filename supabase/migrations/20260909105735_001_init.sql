-- ArcInnoLab V0 — modèle de données Bloc 1 (Gestion de projet accompagné)
-- Rôles fermés : admin / partenaire / porteur (cf Master Prompt V1 §2, révision 09/09)

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type public.user_role as enum ('admin', 'partenaire', 'porteur');
create type public.projet_etat as enum ('brouillon', 'soumis', 'valide', 'en_cours', 'archive');
create type public.rdv_statut as enum ('propose', 'confirme', 'annule', 'termine');
create type public.etape_statut as enum ('a_faire', 'en_cours', 'validee', 'refusee');
create type public.invitation_statut as enum ('en_attente', 'acceptee', 'expiree', 'annulee');
create type public.invitation_role as enum ('partenaire', 'porteur');

-- ============================================================
-- TABLES
-- ============================================================

-- Profils utilisateurs (1-1 avec auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  prenom text not null,
  email text not null,
  role public.user_role not null default 'porteur',
  organisation text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Profils applicatifs, 1-1 avec auth.users. Le rôle ne doit être modifié que par un admin (cf trigger prevent_role_self_escalation).';

-- Projets
create table public.projets (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  etat public.projet_etat not null default 'brouillon',
  date_creation timestamptz not null default now(),
  id_partenaire_createur uuid not null references public.profiles(id)
);

-- Porteurs <-> Projets (many-to-many)
create table public.membres_projet (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_ajout timestamptz not null default now(),
  unique (projet_id, user_id)
);

-- Documents attachés à un projet
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  type text,
  nom_fichier text not null,
  lien_fichier text not null,
  date_upload timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id)
);

-- Référents partenaires additionnels (au-delà du créateur), attribués par l'admin
create table public.projet_partenaire (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  partenaire_id uuid not null references public.profiles(id) on delete cascade,
  date_ajout timestamptz not null default now(),
  unique (projet_id, partenaire_id)
);

-- Rendez-vous
create table public.rendez_vous (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  partenaire_id uuid not null references public.profiles(id),
  projet_id uuid references public.projets(id),
  date_rdv timestamptz not null,
  objet text,
  statut public.rdv_statut not null default 'propose',
  created_at timestamptz not null default now()
);

-- Messagerie privée
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  expediteur_id uuid not null references public.profiles(id),
  destinataire_id uuid not null references public.profiles(id),
  contenu text not null,
  date_envoi timestamptz not null default now(),
  lu boolean not null default false
);

-- Étapes projet ("passeport projet")
create table public.etapes_projet (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  titre text not null,
  statut public.etape_statut not null default 'a_faire',
  ordre int not null default 0,
  avis text,
  id_partenaire_validateur uuid references public.profiles(id),
  date_validation timestamptz
);

-- Invitations nominatives (bootstrap fermé, pas d'auto-inscription)
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_cible public.invitation_role not null,
  token uuid not null default gen_random_uuid() unique,
  statut public.invitation_statut not null default 'en_attente',
  date_envoi timestamptz not null default now(),
  date_expiration timestamptz not null default (now() + interval '7 days'),
  id_emetteur uuid not null references public.profiles(id),
  projet_id uuid references public.projets(id)
);

create index on public.membres_projet (user_id);
create index on public.membres_projet (projet_id);
create index on public.documents (projet_id);
create index on public.projet_partenaire (partenaire_id);
create index on public.rendez_vous (user_id);
create index on public.rendez_vous (partenaire_id);
create index on public.messages (expediteur_id);
create index on public.messages (destinataire_id);
create index on public.etapes_projet (projet_id);
create index on public.invitations (email);
create index on public.invitations (token);

-- ============================================================
-- FONCTIONS UTILITAIRES (security definer pour éviter la récursion RLS sur profiles)
-- ============================================================
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_project_referent(p_projet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projets where id = p_projet_id and id_partenaire_createur = auth.uid()
  ) or exists (
    select 1 from public.projet_partenaire where projet_id = p_projet_id and partenaire_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(p_projet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membres_projet where projet_id = p_projet_id and user_id = auth.uid()
  );
$$;

-- ============================================================
-- TRIGGER : création automatique du profil à l'inscription Supabase Auth
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nom, prenom, email, role, organisation)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'porteur'),
    new.raw_user_meta_data->>'organisation'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TRIGGER : empêche un non-admin de modifier son propre rôle
-- ============================================================
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.get_my_role() is distinct from 'admin' then
    raise exception 'Seul un administrateur peut modifier le rôle d''un utilisateur.';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projets enable row level security;
alter table public.membres_projet enable row level security;
alter table public.documents enable row level security;
alter table public.projet_partenaire enable row level security;
alter table public.rendez_vous enable row level security;
alter table public.messages enable row level security;
alter table public.etapes_projet enable row level security;
alter table public.invitations enable row level security;

-- ---- profiles ----
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.get_my_role() in ('admin', 'partenaire'));

create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.get_my_role() = 'admin');

create policy profiles_delete on public.profiles for delete
  using (public.get_my_role() = 'admin');

-- ---- projets ----
create policy projets_select on public.projets for select
  using (
    public.get_my_role() in ('admin', 'partenaire')
    or public.is_project_member(id)
  );

create policy projets_insert on public.projets for insert
  with check (public.get_my_role() in ('admin', 'partenaire'));

create policy projets_update on public.projets for update
  using (public.get_my_role() = 'admin' or public.is_project_referent(id));

create policy projets_delete on public.projets for delete
  using (public.get_my_role() = 'admin');

-- ---- membres_projet ----
create policy membres_projet_select on public.membres_projet for select
  using (
    public.get_my_role() in ('admin', 'partenaire')
    or user_id = auth.uid()
    or public.is_project_member(projet_id)
  );

create policy membres_projet_insert on public.membres_projet for insert
  with check (public.get_my_role() = 'admin' or public.is_project_referent(projet_id));

create policy membres_projet_delete on public.membres_projet for delete
  using (public.get_my_role() = 'admin' or public.is_project_referent(projet_id));

-- ---- documents ----
create policy documents_select on public.documents for select
  using (
    public.get_my_role() in ('admin', 'partenaire')
    or public.is_project_member(projet_id)
  );

create policy documents_insert on public.documents for insert
  with check (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or public.is_project_member(projet_id)
  );

create policy documents_update on public.documents for update
  using (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or uploaded_by = auth.uid()
  );

create policy documents_delete on public.documents for delete
  using (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or uploaded_by = auth.uid()
  );

-- ---- projet_partenaire ----
create policy projet_partenaire_select on public.projet_partenaire for select
  using (
    public.get_my_role() in ('admin', 'partenaire')
    or public.is_project_member(projet_id)
  );

create policy projet_partenaire_write on public.projet_partenaire for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ---- rendez_vous ----
create policy rendez_vous_select on public.rendez_vous for select
  using (
    public.get_my_role() in ('admin', 'partenaire')
    or user_id = auth.uid()
  );

create policy rendez_vous_insert on public.rendez_vous for insert
  with check (
    public.get_my_role() = 'admin'
    or user_id = auth.uid()
    or partenaire_id = auth.uid()
  );

create policy rendez_vous_update on public.rendez_vous for update
  using (
    public.get_my_role() = 'admin'
    or user_id = auth.uid()
    or partenaire_id = auth.uid()
  );

create policy rendez_vous_delete on public.rendez_vous for delete
  using (public.get_my_role() = 'admin' or partenaire_id = auth.uid());

-- ---- messages ----
create policy messages_select on public.messages for select
  using (
    expediteur_id = auth.uid()
    or destinataire_id = auth.uid()
    or public.get_my_role() = 'admin'
  );

create policy messages_insert on public.messages for insert
  with check (expediteur_id = auth.uid());

create policy messages_update on public.messages for update
  using (destinataire_id = auth.uid() or expediteur_id = auth.uid());

-- ---- etapes_projet ----
create policy etapes_projet_select on public.etapes_projet for select
  using (
    public.get_my_role() in ('admin', 'partenaire')
    or public.is_project_member(projet_id)
  );

create policy etapes_projet_write on public.etapes_projet for all
  using (public.get_my_role() = 'admin' or public.is_project_referent(projet_id))
  with check (public.get_my_role() = 'admin' or public.is_project_referent(projet_id));

-- ---- invitations ----
create policy invitations_select on public.invitations for select
  using (id_emetteur = auth.uid() or public.get_my_role() = 'admin');

create policy invitations_insert on public.invitations for insert
  with check (
    id_emetteur = auth.uid()
    and (
      (role_cible = 'partenaire' and public.get_my_role() = 'admin')
      or (role_cible = 'porteur' and public.get_my_role() in ('admin', 'partenaire'))
    )
  );

create policy invitations_update on public.invitations for update
  using (id_emetteur = auth.uid() or public.get_my_role() = 'admin');

create policy invitations_delete on public.invitations for delete
  using (id_emetteur = auth.uid() or public.get_my_role() = 'admin');
