-- ArcInnoLab — schéma complet, concaténation des migrations dans l'ordre.
-- Généré le 15/09/2026. À coller dans le SQL Editor de Supabase sur un projet VIERGE.
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

-- ============================================================
-- 20260914115605_010_accueil_et_orientation.sql
-- ============================================================
-- ArcInnoLab — brique Accueil & Orientation.
--
-- Deux services sur deux horloges (cf. référentiel de la démarche) :
--   · accueil + orientation : permanent, décidé par le coach seul ;
--   · accompagnement        : par promotion annuelle, décidé par le comité mixte.
-- Le comité ne siégeant qu'une fois par an, l'orientation est le service
-- principal onze mois sur douze : elle ne peut pas dépendre du comité.

-- ── Personas ────────────────────────────────────────────────────────────────
-- Issus du document « Persona » fourni le 10/09/2026. Les clés sont
-- descriptives : les prénoms de la slide (Naël.le, Mika, Morgan, Sacha, Élie)
-- n'ont pas pu être rattachés de façon certaine, seul « Élie » est explicite
-- dans le document. Le libellé affiché est porté par l'application.
create type public.persona as enum (
  'innovation_sociale',        -- 38 ans, soin/handicap/low-tech, logique d'impact
  'startup_industrielle',      -- 50 ans, réparabilité, open hardware, production locale
  'dirigeant_pme_eti',         -- 52 ans, filière collective, cherche qui finance
  'intrapreneur_territorial',  -- 44 ans, tiers-lieux et collectivités, projet porté pour autrui
  'etudiant_entrepreneur',     -- 23 ans (Élie), idéation, besoin de mentorat
  'pme_familiale'              -- 56 ans, mécanique de précision Jura, veut des preuves
);

comment on type public.persona is
  'Profils types du document Persona (10/09/2026). Sert à orienter le pack de services.';

-- ── Cycle de vie d'une demande ──────────────────────────────────────────────
create type public.demande_statut as enum (
  'nouvelle',           -- déposée, pas encore prise en charge
  'en_accueil',         -- un coach s'en occupe, RDV d'accueil en cours
  'orientee',           -- sortie par l'orientation : mise(s) en relation faite(s)
  'en_attente_comite',  -- candidate à l'accompagnement, attend le prochain comité
  'admise',             -- retenue par le comité, entre en promotion
  'non_retenue',        -- examinée par le comité, non retenue
  'close'               -- sans suite (abandon, doublon, hors périmètre)
);

create type public.pays as enum ('france', 'suisse');

-- ── Promotions ──────────────────────────────────────────────────────────────
-- Le comité mixte siège une fois par an : l'accompagnement se fait donc par
-- cohortes. Un porteur arrivé juste après un comité peut attendre onze mois —
-- d'où l'importance de lui montrer quand siège le prochain.
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  nom text not null,                       -- ex. « Promotion 2027 »
  date_comite date,                        -- date prévue ou tenue du comité mixte
  ouverte boolean not null default true,   -- accepte-t-elle encore des candidatures ?
  created_at timestamptz not null default now()
);

alter table public.promotions enable row level security;

create policy promotions_select on public.promotions
  for select to authenticated using (true);

create policy promotions_write on public.promotions
  for all to authenticated
  using (get_my_role() = 'admin'::user_role)
  with check (get_my_role() = 'admin'::user_role);

-- ── Demandes d'accueil ──────────────────────────────────────────────────────
-- La porte d'entrée du guichet. Déposable SANS COMPTE : un guichet où il faut
-- être invité n'est pas un guichet. La plateforme reste fermée pour autant —
-- c'est le coach qui invite, une fois la demande qualifiée.
create table public.demandes_accueil (
  id uuid primary key default gen_random_uuid(),

  -- Renseigné par la personne qui dépose la demande
  nom text not null,
  prenom text not null,
  email text not null,
  telephone text,
  organisation text,
  pays public.pays not null,
  titre_projet text not null,
  description text not null,

  -- Renseigné par le coach lors de l'accueil
  statut public.demande_statut not null default 'nouvelle',
  persona public.persona,
  coach_id uuid references public.profiles(id) on delete set null,
  notes_coach text,

  -- Rattachements, quand la demande aboutit
  promotion_id uuid references public.promotions(id) on delete set null,
  projet_id uuid references public.projets(id) on delete set null,
  profil_cree_id uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index demandes_statut_idx on public.demandes_accueil (statut, created_at desc);
create index demandes_coach_idx on public.demandes_accueil (coach_id);
create index demandes_promotion_idx on public.demandes_accueil (promotion_id);

alter table public.demandes_accueil enable row level security;

-- Dépôt public : c'est le seul point de la plateforme ouvert à un anonyme.
-- Il n'autorise QUE l'insertion : personne ne peut relire les demandes sans
-- être authentifié, et une demande déposée ne peut plus être modifiée par son
-- auteur.
create policy demandes_insert_public on public.demandes_accueil
  for insert to anon, authenticated
  with check (true);

create policy demandes_select on public.demandes_accueil
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy demandes_update on public.demandes_accueil
  for update to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy demandes_delete on public.demandes_accueil
  for delete to authenticated
  using (get_my_role() = 'admin'::user_role);

-- ── Orientations ────────────────────────────────────────────────────────────
-- La sortie « rapide » : le coach met en relation et trace l'issue. Tracer
-- l'issue n'est pas de la bureaucratie — sans elle, on ne sait jamais si
-- l'orientation a produit quelque chose, et le manifeste promet qu'un porteur
-- « n'est jamais seul ».
create type public.orientation_issue as enum (
  'en_attente',      -- mise en relation faite, pas encore de retour
  'contact_etabli',  -- le porteur et la structure se sont parlé
  'sans_suite'       -- pas de suite, à requalifier
);

create table public.orientations (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_accueil(id) on delete cascade,
  structure text not null,          -- vers qui : partenaire, dispositif, réseau
  motif text,                       -- pourquoi cette orientation
  issue public.orientation_issue not null default 'en_attente',
  date_relance date,                -- quand revenir vers le porteur
  notes text,
  cree_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index orientations_demande_idx on public.orientations (demande_id);
create index orientations_issue_idx on public.orientations (issue, date_relance);

alter table public.orientations enable row level security;

create policy orientations_select on public.orientations
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy orientations_write on public.orientations
  for all to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]))
  with check (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

-- ── Horodatage ──────────────────────────────────────────────────────────────
create or replace function public.touch_demande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_demande() from public, anon, authenticated;

create trigger demandes_touch
  before update on public.demandes_accueil
  for each row execute function public.touch_demande();

-- ============================================================
-- 20260914115731_011_nettoyage_demande_de_test.sql
-- ============================================================
-- Retire la demande insérée le 14/09/2026 pour vérifier, depuis un navigateur
-- et avec la clé publique, que la porte d'entrée anonyme accepte bien un dépôt
-- sans permettre la moindre lecture. Test concluant : 201 à l'écriture, zéro
-- ligne lisible sur les sept tables interrogées.
delete from public.demandes_accueil where email = 'test-anon@example.org';

-- ============================================================
-- 20260914142438_012_suivi_porteur_et_alerte_equipe.sql
-- ============================================================
-- Fermer la boucle du porteur.
--
-- Jusqu'ici, une personne déposait sa demande et n'avait plus aucune nouvelle
-- jusqu'à ce qu'un coach la contacte. Le manifeste promet pourtant qu'un
-- porteur « n'est jamais seul : il sait toujours à qui s'adresser, et comment
-- avancer ». Deux manques à combler : le porteur ne peut pas savoir où en est
-- sa demande, et l'équipe n'est pas prévenue qu'une demande est arrivée.
--
-- L'envoi d'e-mails supposerait un service tiers et un nom de domaine vérifié,
-- qu'ArcInnoLab n'a pas encore. La boucle se ferme donc autrement : un lien de
-- suivi personnel remis au dépôt, et une alerte interne à l'équipe.

-- ── Jeton de suivi ──────────────────────────────────────────────────────────
alter table public.demandes_accueil
  add column if not exists token_suivi uuid not null default gen_random_uuid();

create unique index if not exists demandes_token_suivi_idx
  on public.demandes_accueil (token_suivi);

comment on column public.demandes_accueil.token_suivi is
  'Jeton remis au porteur au moment du dépôt. Lui seul permet de consulter '
  'l''état de sa demande, sans compte. Ne jamais exposer cette colonne dans '
  'une réponse destinée à un tiers.';

-- ── Consultation publique de l'état ─────────────────────────────────────────
-- Même pattern que get_invitation_preview : une fonction SECURITY DEFINER
-- appelée sans session, qui ne renvoie QUE ce qui concerne le porteur. Ni les
-- notes du coach, ni l'identité des personnes qui traitent le dossier, ni les
-- motifs d'orientation — ce sont des éléments de travail interne.
create or replace function public.get_suivi_demande(p_token uuid)
returns table (
  titre_projet text,
  prenom text,
  statut public.demande_statut,
  deposee_le timestamptz,
  mise_a_jour_le timestamptz,
  prise_en_charge boolean,
  nb_orientations integer,
  promotion_nom text,
  promotion_date_comite date
)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.titre_projet,
    d.prenom,
    d.statut,
    d.created_at,
    d.updated_at,
    d.coach_id is not null,
    (select count(*)::integer from public.orientations o where o.demande_id = d.id),
    p.nom,
    p.date_comite
  from public.demandes_accueil d
  left join public.promotions p on p.id = d.promotion_id
  where d.token_suivi = p_token;
$$;

-- ── Alerte de l'équipe à chaque dépôt ───────────────────────────────────────
-- Le dépôt se fait sans session : la server action tourne en `anon` et ne peut
-- donc pas écrire dans `notifications`, dont la policy exige un utilisateur
-- authentifié. D'où un trigger SECURITY DEFINER, qui prévient tous les
-- administrateurs et partenaires.
--
-- Sans cette alerte, une demande peut rester invisible jusqu'à ce que
-- quelqu'un pense à ouvrir la file — or une demande sans réponse est le seul
-- vrai échec de ce guichet.
create or replace function public.notifier_nouvelle_demande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, titre, lien)
  select
    pr.id,
    'demande_accueil',
    'Nouvelle demande : ' || new.titre_projet,
    '/demandes/' || new.id::text
  from public.profiles pr
  where pr.role in ('admin', 'partenaire');

  return new;
end;
$$;

revoke execute on function public.notifier_nouvelle_demande() from public, anon, authenticated;

drop trigger if exists demandes_notifier_equipe on public.demandes_accueil;
create trigger demandes_notifier_equipe
  after insert on public.demandes_accueil
  for each row execute function public.notifier_nouvelle_demande();

-- ============================================================
-- 20260914151007_013_tours_de_vote_partenaires.sql
-- ============================================================
-- Instruction collégiale d'une candidature : le tour de vote.
--
-- Rôle retenu : le vote PRÉPARE le comité, il ne décide pas à sa place. Les
-- partenaires instruisent le dossier en cinq jours ; le comité mixte reste
-- l'instance qui tranche. L'application matérialise cette distinction — un
-- tour clos ne change pas le statut de la demande, il produit un avis.
--
-- Règle retenue : tous les partenaires doivent se prononcer. Elle est la plus
-- légitime, mais elle a un défaut connu : un partenaire absent bloquerait le
-- porteur indéfiniment. D'où la clôture sur constat d'absence, ouverte à
-- l'admin une fois l'échéance passée, et qui laisse trace des non-réponses.

create type public.vote_position as enum ('favorable', 'defavorable', 'abstention');

create type public.tour_statut as enum (
  'en_cours',   -- dans les cinq jours, tout le monde n'a pas voté
  'complet',    -- tous les votants attendus se sont prononcés
  'clos',       -- clos par l'admin (à l'échéance, ou après complétude)
  'abandonne'   -- annulé sans suite
);

-- ── Tours de vote ───────────────────────────────────────────────────────────
create table public.tours_vote (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_accueil(id) on delete cascade,
  promotion_id uuid references public.promotions(id) on delete set null,

  ouvert_par uuid references public.profiles(id) on delete set null,
  ouvert_le timestamptz not null default now(),
  -- Cinq jours pleins. Stockée et non recalculée : si la règle change un jour,
  -- les tours déjà ouverts gardent l'échéance annoncée à leurs votants.
  date_limite timestamptz not null default (now() + interval '5 days'),

  statut public.tour_statut not null default 'en_cours',
  clos_le timestamptz,
  clos_par uuid references public.profiles(id) on delete set null,

  -- Nombre de personnes attendues, figé à l'ouverture : si un partenaire
  -- rejoint la plateforme pendant le tour, il ne doit pas rendre soudainement
  -- incomplet un tour qui ne l'était pas.
  votants_attendus integer not null default 0,

  -- Synthèse des avis, destinée à l'instruction interne.
  synthese text,
  synthese_le timestamptz,
  synthese_par_ia boolean not null default false,

  created_at timestamptz not null default now()
);

create index tours_demande_idx on public.tours_vote (demande_id, created_at desc);
create index tours_statut_idx on public.tours_vote (statut, date_limite);

alter table public.tours_vote enable row level security;

create policy tours_select on public.tours_vote
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy tours_insert on public.tours_vote
  for insert to authenticated
  with check (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy tours_update on public.tours_vote
  for update to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

-- ── Votes ───────────────────────────────────────────────────────────────────
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours_vote(id) on delete cascade,
  votant_id uuid not null references public.profiles(id) on delete cascade,
  position public.vote_position not null,
  motif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tour_id, votant_id),

  -- Un avis défavorable sans motif est inexploitable : ni pour le porteur, à
  -- qui l'on doit une explication, ni pour les autres partenaires, qui doivent
  -- pouvoir en débattre. La contrainte est posée ici plutôt que dans
  -- l'interface : c'est une règle de fond, pas une validation de formulaire.
  constraint vote_defavorable_motive check (
    position <> 'defavorable' or (motif is not null and length(btrim(motif)) >= 10)
  )
);

create index votes_tour_idx on public.votes (tour_id);

alter table public.votes enable row level security;

-- Les avis sont visibles de toute l'équipe : c'est une instruction collégiale,
-- pas un scrutin secret. Chacun doit pouvoir lire les arguments des autres.
create policy votes_select on public.votes
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

-- On ne vote que pour soi, et seulement tant que le tour est ouvert.
create policy votes_insert on public.votes
  for insert to authenticated
  with check (
    votant_id = auth.uid()
    and get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
    and exists (
      select 1 from public.tours_vote t
      where t.id = tour_id and t.statut in ('en_cours', 'complet')
    )
  );

create policy votes_update on public.votes
  for update to authenticated
  using (
    votant_id = auth.uid()
    and exists (
      select 1 from public.tours_vote t
      where t.id = tour_id and t.statut in ('en_cours', 'complet')
    )
  );

-- ── Ce que lit le porteur ───────────────────────────────────────────────────
-- Le message communiqué est distinct des motifs de vote : ceux-ci sont écrits
-- entre professionnels et tombent souvent mal quand ils sont lus par la
-- personne concernée. L'admin valide toujours ce qui part.
alter table public.demandes_accueil
  add column if not exists message_porteur text;

comment on column public.demandes_accueil.message_porteur is
  'Message communiqué au porteur avec la décision. Validé par un humain avant '
  'publication, même lorsqu''il a été rédigé automatiquement.';

-- ── Passage à l'état « en instruction » ─────────────────────────────────────
alter type public.demande_statut add value if not exists 'en_instruction' after 'en_attente_comite';

-- ============================================================
-- 20260914151058_014_mecanique_du_tour_de_vote.sql
-- ============================================================
-- Mécanique du tour : qui est attendu, et quand le tour devient complet.
-- Séparée de la migration 013 parce qu'elle utilise la valeur d'énumération
-- « en_instruction » ajoutée là-bas : PostgreSQL interdit d'employer une
-- valeur d'enum dans la transaction qui la crée.

-- ── Qui doit voter ──────────────────────────────────────────────────────────
-- Les parties prenantes : administrateurs et partenaires du consortium. Les
-- porteurs n'ont évidemment pas voix au chapitre sur leur propre dossier.
create or replace function public.nb_votants_attendus()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.profiles
  where role in ('admin', 'partenaire');
$$;

-- ── Bascule automatique en « complet » ──────────────────────────────────────
-- Dès que tout le monde s'est prononcé, le tour n'attend plus personne. Il
-- n'est pas clos pour autant : la clôture reste un geste humain, parce qu'elle
-- déclenche la rédaction de l'avis.
create or replace function public.maj_completude_tour()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
  nb_votes integer;
  nb_attendus integer;
begin
  t_id := coalesce(new.tour_id, old.tour_id);

  select count(*) into nb_votes from public.votes where tour_id = t_id;
  select votants_attendus into nb_attendus from public.tours_vote where id = t_id;

  update public.tours_vote
     set statut = case
                    when statut in ('clos', 'abandonne') then statut
                    when nb_votes >= nb_attendus then 'complet'::tour_statut
                    else 'en_cours'::tour_statut
                  end
   where id = t_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.maj_completude_tour() from public, anon, authenticated;

drop trigger if exists votes_majcompletude on public.votes;
create trigger votes_majcompletude
  after insert or update or delete on public.votes
  for each row execute function public.maj_completude_tour();

-- ── Horodatage des votes modifiés ───────────────────────────────────────────
create or replace function public.touch_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_vote() from public, anon, authenticated;

drop trigger if exists votes_touch on public.votes;
create trigger votes_touch
  before update on public.votes
  for each row execute function public.touch_vote();

-- ── Ce que voit le porteur, enrichi ─────────────────────────────────────────
-- La fonction de suivi gagne l'état d'instruction et le message de décision.
-- Elle continue de ne rien révéler des votes individuels : le porteur lit une
-- position collective, jamais qui a dit quoi.
--
-- La suppression préalable est nécessaire : PostgreSQL refuse de changer le
-- type de retour d'une fonction existante par un simple CREATE OR REPLACE.
drop function if exists public.get_suivi_demande(uuid);

create function public.get_suivi_demande(p_token uuid)
returns table (
  titre_projet text,
  prenom text,
  statut public.demande_statut,
  deposee_le timestamptz,
  mise_a_jour_le timestamptz,
  prise_en_charge boolean,
  nb_orientations integer,
  promotion_nom text,
  promotion_date_comite date,
  message_porteur text,
  instruction_en_cours boolean,
  instruction_echeance timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.titre_projet,
    d.prenom,
    d.statut,
    d.created_at,
    d.updated_at,
    d.coach_id is not null,
    (select count(*)::integer from public.orientations o where o.demande_id = d.id),
    p.nom,
    p.date_comite,
    d.message_porteur,
    exists (
      select 1 from public.tours_vote t
      where t.demande_id = d.id and t.statut in ('en_cours', 'complet')
    ),
    (select max(t.date_limite) from public.tours_vote t
      where t.demande_id = d.id and t.statut in ('en_cours', 'complet'))
  from public.demandes_accueil d
  left join public.promotions p on p.id = d.promotion_id
  where d.token_suivi = p_token;
$$;

-- ============================================================
-- 20260915070330_015_alertes_echanges_et_acces.sql
-- ============================================================
-- Trois manques révélés par le test de César, qui ont tous la même cause :
-- l'application sait faire des choses qu'elle ne montre pas.
--
--  1. Un tour de vote s'ouvrait sans prévenir personne. Les partenaires
--     n'avaient aucun moyen d'apprendre qu'un avis leur était demandé.
--  2. Le porteur et l'équipe n'avaient aucun moyen d'échanger : le suivi était
--     en lecture seule, ce qui laisse une personne sans réponse devant un
--     écran qui affiche « nous revenons vers vous ».
--  3. Une personne qui perd son mot de passe n'avait aucune issue, faute de
--     service d'envoi d'e-mails.

-- ── 1. Prévenir les partenaires qu'un avis est attendu ──────────────────────
create or replace function public.notifier_ouverture_tour()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  titre_demande text;
begin
  select titre_projet into titre_demande
  from public.demandes_accueil where id = new.demande_id;

  insert into public.notifications (user_id, type, titre, lien)
  select
    pr.id,
    'tour_vote',
    'Votre avis est attendu : ' || coalesce(titre_demande, 'une candidature'),
    '/demandes/' || new.demande_id::text
  from public.profiles pr
  where pr.role in ('admin', 'partenaire')
    -- Inutile de se notifier soi-même : on vient d'ouvrir le tour.
    and pr.id is distinct from new.ouvert_par;

  return new;
end;
$$;

revoke execute on function public.notifier_ouverture_tour() from public, anon, authenticated;

drop trigger if exists tours_notifier_partenaires on public.tours_vote;
create trigger tours_notifier_partenaires
  after insert on public.tours_vote
  for each row execute function public.notifier_ouverture_tour();

-- ── 2. Échanger avec le porteur ─────────────────────────────────────────────
-- Le porteur n'a pas de compte : il écrit depuis sa page de suivi, identifié
-- par son seul jeton. L'équipe répond depuis la fiche de traitement.
create type public.auteur_message as enum ('porteur', 'equipe');

create table public.messages_demande (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_accueil(id) on delete cascade,
  auteur public.auteur_message not null,
  -- Renseigné seulement côté équipe : le porteur n'a pas de profil.
  auteur_id uuid references public.profiles(id) on delete set null,
  contenu text not null,
  lu_par_equipe boolean not null default false,
  lu_par_porteur boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_demande_idx on public.messages_demande (demande_id, created_at);

alter table public.messages_demande enable row level security;

create policy messages_demande_select on public.messages_demande
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy messages_demande_insert on public.messages_demande
  for insert to authenticated
  with check (
    auteur = 'equipe'
    and auteur_id = auth.uid()
    and get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
  );

create policy messages_demande_update on public.messages_demande
  for update to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

-- Lecture du fil par le porteur, via son jeton. Ne renvoie que le strict
-- nécessaire : ni l'identité des membres de l'équipe, ni les états de lecture.
create or replace function public.get_messages_suivi(p_token uuid)
returns table (
  auteur public.auteur_message,
  contenu text,
  envoye_le timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select m.auteur, m.contenu, m.created_at
  from public.messages_demande m
  join public.demandes_accueil d on d.id = m.demande_id
  where d.token_suivi = p_token
  order by m.created_at;
$$;

-- Écriture par le porteur. La fonction vérifie elle-même le jeton : c'est lui
-- qui tient lieu d'authentification, et rien d'autre ne permet d'écrire.
create or replace function public.poster_message_porteur(p_token uuid, p_contenu text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d_id uuid;
begin
  if p_contenu is null or length(btrim(p_contenu)) < 2 then
    raise exception 'Message vide.';
  end if;
  if length(p_contenu) > 5000 then
    raise exception 'Message trop long.';
  end if;

  select id into d_id from public.demandes_accueil where token_suivi = p_token;
  if d_id is null then
    raise exception 'Lien de suivi invalide.';
  end if;

  insert into public.messages_demande (demande_id, auteur, contenu)
  values (d_id, 'porteur', btrim(p_contenu));

  -- L'équipe est prévenue : un message qui dort est un porteur qui attend.
  insert into public.notifications (user_id, type, titre, lien)
  select pr.id, 'message_demande',
         'Message d''un porteur sur sa demande',
         '/demandes/' || d_id::text
  from public.profiles pr
  where pr.role in ('admin', 'partenaire');

  return true;
end;
$$;

-- ── 3. Rendre l'accès à quelqu'un qui l'a perdu ─────────────────────────────
-- Sans service d'envoi d'e-mails, un mot de passe oublié est une impasse.
-- L'administrateur engendre ici un lien à usage unique, qu'il transmet par le
-- moyen de son choix. Le mot de passe est choisi par la personne elle-même :
-- personne d'autre ne le voit, jamais.
create table public.reinitialisations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  cree_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expire_le timestamptz not null default (now() + interval '48 hours'),
  utilise_le timestamptz
);

create index reinit_token_idx on public.reinitialisations (token);

alter table public.reinitialisations enable row level security;

create policy reinit_select on public.reinitialisations
  for select to authenticated
  using (get_my_role() = 'admin'::user_role);

create policy reinit_insert on public.reinitialisations
  for insert to authenticated
  with check (get_my_role() = 'admin'::user_role and cree_par = auth.uid());

-- Aperçu public : dit seulement si le lien est valide et à qui il appartient.
create or replace function public.get_reinitialisation(p_token uuid)
returns table (email text, prenom text, valide boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.email, p.prenom,
         (r.utilise_le is null and r.expire_le > now())
  from public.reinitialisations r
  join public.profiles p on p.id = r.user_id
  where r.token = p_token;
$$;

-- Application du nouveau mot de passe, choisi par la personne concernée.
create or replace function public.appliquer_reinitialisation(p_token uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  r record;
begin
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Mot de passe trop court (8 caractères minimum).';
  end if;

  select * into r from public.reinitialisations where token = p_token for update;

  if r is null then
    raise exception 'Lien invalide.';
  end if;
  if r.utilise_le is not null then
    raise exception 'Ce lien a déjà été utilisé.';
  end if;
  if r.expire_le < now() then
    raise exception 'Ce lien a expiré. Demandez-en un nouveau.';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where id = r.user_id;

  update public.reinitialisations set utilise_le = now() where id = r.id;

  return true;
end;
$$;
