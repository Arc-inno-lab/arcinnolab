-- ArcInnoLab — schéma complet, concaténation des 10 migrations dans l'ordre.
-- Généré le 10/09/2026. À coller dans le SQL Editor de Supabase sur un projet VIERGE.
-- Vérification d'intégrité de la source : voir CHECKSUMS.md5

-- ============================================================
-- 20260909105735_001_init.sql
-- ============================================================
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

-- ============================================================
-- 20260909105757_002_restrict_trigger_functions.sql
-- ============================================================
-- Ces fonctions ne doivent être invoquées que par leurs triggers, jamais directement via l'API REST/RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_role_self_escalation() from public, anon, authenticated;

-- ============================================================
-- 20260909114006_002_auth_functions.sql
-- ============================================================
-- ArcInnoLab V0 — création de comptes sans clé service_role.
-- Toute la logique (bootstrap admin, acceptation d'invitation) passe par des fonctions
-- SECURITY DEFINER appelées via la clé anon : aucune variable d'environnement secrète
-- n'est nécessaire côté application, donc aucune configuration manuelle sur Vercel.

create or replace function public.create_auth_user(
  p_email text,
  p_password text,
  p_nom text,
  p_prenom text,
  p_role public.user_role,
  p_organisation text
)
returns uuid
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  new_user_id uuid;
begin
  if exists (select 1 from auth.users where email = p_email) then
    raise exception 'Un compte existe déjà avec cet email.';
  end if;

  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nom', p_nom, 'prenom', p_prenom, 'role', p_role, 'organisation', p_organisation),
    now(), now(),
    '', '', '', '',
    false, false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email),
    'email', now(), now(), now()
  );

  return new_user_id;
end;
$$;

revoke execute on function public.create_auth_user(text, text, text, text, public.user_role, text) from public, anon, authenticated;

create or replace function public.bootstrap_admin(
  p_email text,
  p_password text,
  p_nom text,
  p_prenom text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count int;
  new_id uuid;
begin
  select count(*) into admin_count from public.profiles where role = 'admin';
  if admin_count > 0 then
    raise exception 'Un compte administrateur existe déjà. Le bootstrap est désactivé.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Mot de passe trop court (8 caractères minimum).';
  end if;
  if coalesce(p_email, '') = '' or coalesce(p_nom, '') = '' or coalesce(p_prenom, '') = '' then
    raise exception 'Merci de renseigner tous les champs.';
  end if;

  new_id := public.create_auth_user(p_email, p_password, p_nom, p_prenom, 'admin'::public.user_role, null);
  return new_id;
end;
$$;

create or replace function public.admin_exists()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where role = 'admin');
$$;

create or replace function public.get_invitation_preview(p_token uuid)
returns table (
  email text,
  role_cible public.invitation_role,
  statut public.invitation_statut,
  date_expiration timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select email, role_cible, statut, date_expiration
  from public.invitations
  where token = p_token;
$$;

create or replace function public.accept_invitation(
  p_token uuid,
  p_password text,
  p_nom text,
  p_prenom text,
  p_organisation text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  new_id uuid;
begin
  select * into inv from public.invitations where token = p_token for update;

  if inv is null then
    raise exception 'Invitation introuvable.';
  end if;
  if inv.statut <> 'en_attente' then
    raise exception 'Cette invitation n''est plus valide.';
  end if;
  if inv.date_expiration < now() then
    update public.invitations set statut = 'expiree' where id = inv.id;
    raise exception 'Cette invitation a expiré. Demandez à votre référent d''en générer une nouvelle.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Mot de passe trop court (8 caractères minimum).';
  end if;
  if coalesce(p_nom, '') = '' or coalesce(p_prenom, '') = '' then
    raise exception 'Merci de renseigner tous les champs.';
  end if;

  new_id := public.create_auth_user(
    inv.email, p_password, p_nom, p_prenom,
    (inv.role_cible::text)::public.user_role,
    nullif(p_organisation, '')
  );

  if inv.projet_id is not null and inv.role_cible = 'porteur' then
    insert into public.membres_projet (projet_id, user_id) values (inv.projet_id, new_id);
  end if;

  update public.invitations set statut = 'acceptee' where id = inv.id;

  return new_id;
end;
$$;

-- ============================================================
-- 20260909114122_003_fix_search_path_pgcrypto.sql
-- ============================================================
create or replace function public.create_auth_user(
  p_email text,
  p_password text,
  p_nom text,
  p_prenom text,
  p_role public.user_role,
  p_organisation text
)
returns uuid
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  new_user_id uuid;
begin
  if exists (select 1 from auth.users where email = p_email) then
    raise exception 'Un compte existe déjà avec cet email.';
  end if;

  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nom', p_nom, 'prenom', p_prenom, 'role', p_role, 'organisation', p_organisation),
    now(), now(),
    '', '', '', '',
    false, false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email),
    'email', now(), now(), now()
  );

  return new_user_id;
end;
$$;

revoke execute on function public.create_auth_user(text, text, text, text, public.user_role, text) from public, anon, authenticated;

-- ============================================================
-- 20260909120515_004_tighten_projets_insert.sql
-- ============================================================
-- La brique "fiche projet" ajoute la création réelle de projets : on resserre la policy
-- d'insertion pour qu'un Partenaire ne puisse se déclarer référent que de lui-même.
-- L'Admin garde la liberté de désigner n'importe quel référent (réassignation).
drop policy if exists projets_insert on public.projets;
create policy projets_insert on public.projets
  for insert
  with check (
    get_my_role() = 'admin'::user_role
    or (get_my_role() = 'partenaire'::user_role and id_partenaire_createur = auth.uid())
  );

-- ============================================================
-- 20260909135356_005_messagerie_projet_et_notifications.sql
-- ============================================================
-- Messagerie de projet : fil de discussion visible par tous les membres d'un projet
-- (porteurs rattachés + tous les partenaires/admin, cohérent avec la transparence déjà en place
-- sur le reste des données projet). Remplace/complète la table "messages" 1-1 du schéma initial,
-- qui ne convient pas à un fil de groupe par projet.
create table public.messages_projet (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  auteur_id uuid not null references public.profiles(id),
  contenu text not null,
  created_at timestamptz not null default now()
);

alter table public.messages_projet enable row level security;

create policy messages_projet_select on public.messages_projet
  for select
  using (
    get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
    or is_project_member(projet_id)
  );

create policy messages_projet_insert on public.messages_projet
  for insert
  with check (
    auteur_id = auth.uid()
    and (
      get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
      or is_project_member(projet_id)
    )
  );

-- Notifications in-app : nouvelle étape, étape validée/refusée, nouveau message.
-- V0 : n'importe quel utilisateur authentifié peut créer une notification pour un autre
-- (plateforme fermée, usage interne uniquement) — le contenu reste géré par les server actions.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  titre text not null,
  lien text,
  lu boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select
  using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update
  using (user_id = auth.uid());

create policy notifications_insert on public.notifications
  for insert
  to authenticated
  with check (true);

create index notifications_user_unread_idx on public.notifications (user_id, lu, created_at desc);
create index messages_projet_projet_idx on public.messages_projet (projet_id, created_at);

-- ============================================================
-- 20260909143853_006_identite_kanban_fichiers_dm.sql
-- ============================================================
-- Identité visuelle (logos/avatars), sous-fils par étape, fiche porteur enrichie, messagerie directe.

alter table public.profiles add column if not exists photo_url text;
alter table public.projets add column if not exists logo_url text;
alter table public.invitations add column if not exists nom text;
alter table public.invitations add column if not exists prenom text;
alter table public.invitations add column if not exists organisation text;

-- Pièces jointes rattachables à une étape précise (en plus du projet global).
alter table public.documents add column if not exists etape_id uuid references public.etapes_projet(id) on delete cascade;
create index if not exists documents_etape_idx on public.documents(etape_id);

-- Sous-fil de discussion par étape : on réutilise messages_projet (mêmes droits, membres du projet),
-- simplement filtré par etape_id quand non nul.
alter table public.messages_projet add column if not exists etape_id uuid references public.etapes_projet(id) on delete cascade;
create index if not exists messages_projet_etape_idx on public.messages_projet(etape_id);

-- Index pour la messagerie directe (table "messages" déjà créée avec RLS dans le schéma initial).
create index if not exists messages_expediteur_idx on public.messages(expediteur_id, date_envoi);
create index if not exists messages_destinataire_idx on public.messages(destinataire_id, date_envoi);

-- Bucket de stockage unique pour logos de projet, avatars et pièces jointes.
-- Lecture publique (assets non confidentiels par défaut, cohérent avec le modèle "plateforme
-- fermée à accès nominatif" déjà utilisé pour les notifications) ; écriture réservée aux
-- utilisateurs authentifiés, modification/suppression réservées au propriétaire du fichier.
insert into storage.buckets (id, name, public)
values ('arcinnolab-media', 'arcinnolab-media', true)
on conflict (id) do nothing;

drop policy if exists arcinnolab_media_public_read on storage.objects;
create policy arcinnolab_media_public_read on storage.objects
  for select using (bucket_id = 'arcinnolab-media');

drop policy if exists arcinnolab_media_authenticated_insert on storage.objects;
create policy arcinnolab_media_authenticated_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'arcinnolab-media');

drop policy if exists arcinnolab_media_owner_update on storage.objects;
create policy arcinnolab_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'arcinnolab-media' and owner = auth.uid());

drop policy if exists arcinnolab_media_owner_delete on storage.objects;
create policy arcinnolab_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'arcinnolab-media' and owner = auth.uid());

-- ============================================================
-- 20260909144447_007_profiles_select_annuaire_ouvert.sql
-- ============================================================
-- Ouvre la lecture des profils à tout utilisateur authentifié (au lieu de : soi-même, ou admin/
-- partenaire). Nécessaire pour : l'annuaire "contacter un partenaire" sur le tableau de bord
-- (visible par tous les rôles), et pour que les membres d'un même projet voient les noms de
-- leurs coéquipiers (un porteur ne voyait jusqu'ici même pas le nom de son propre référent).
-- Cohérent avec le modèle déjà retenu ailleurs (plateforme fermée, accès nominatif uniquement,
-- cf. RLS permissive de la table notifications) — mais élargit la visibilité des emails à tous
-- les comptes, à signaler à César comme point à trancher (cf. doc de statut).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

-- ============================================================
-- 20260909145441_008_temp_anon_upload_assets_statiques.sql
-- ============================================================
-- Policy temporaire pour permettre l'upload initial des assets de marque statiques (logos,
-- visuel d'accueil) depuis un script one-off avec la clé anon, sans passer par une session
-- utilisateur. Supprimée juste après l'upload (voir migration 009).
create policy arcinnolab_media_temp_anon_insert on storage.objects
  for insert to anon
  with check (bucket_id = 'arcinnolab-media');

-- ============================================================
-- 20260909145633_009_retrait_policy_temp_anon.sql
-- ============================================================
drop policy if exists arcinnolab_media_temp_anon_insert on storage.objects;

