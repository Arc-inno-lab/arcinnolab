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
