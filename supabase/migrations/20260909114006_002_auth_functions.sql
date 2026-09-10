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
