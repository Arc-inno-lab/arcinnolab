-- 028 · Demandes d'accès à la plateforme, validées une par une par l'administrateur.
--
-- Pour ouvrir des comptes en nombre sans rien créer automatiquement :
--   · un formulaire public « Rejoindre ArcInnoLab » (lien à envoyer aux
--     partenaires) dépose une demande d'accès ;
--   · l'administrateur peut aussi coller une liste (modèle CSV) : chaque ligne
--     devient une demande d'accès, pas un compte ;
--   · dans l'Administration, il choisit le rôle de chacun et valide. Seule la
--     validation crée une invitation, qui part par e-mail (migration 027).
--     La personne choisit elle-même son mot de passe.

create table if not exists public.demandes_acces (
  id uuid primary key default gen_random_uuid(),
  prenom text not null check (length(btrim(prenom)) between 1 and 80),
  nom text not null check (length(btrim(nom)) between 1 and 80),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  organisation text check (organisation is null or length(organisation) <= 160),
  fonction text check (fonction is null or length(fonction) <= 160),
  role_souhaite text not null default 'partenaire' check (role_souhaite in ('partenaire', 'porteur')),
  message text check (message is null or length(message) <= 1000),
  source text not null default 'formulaire' check (source in ('formulaire', 'import')),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'validee', 'refusee')),
  role_attribue text check (role_attribue is null or role_attribue in ('partenaire', 'porteur')),
  invitation_id uuid references public.invitations(id) on delete set null,
  traite_par uuid references public.profiles(id) on delete set null,
  traite_le timestamptz,
  created_at timestamptz not null default now()
);

-- Une seule demande en attente par adresse.
create unique index if not exists demandes_acces_email_attente
  on public.demandes_acces (lower(email)) where statut = 'en_attente';

alter table public.demandes_acces enable row level security;

-- Lecture et import : l'administrateur seul. Le formulaire public passe par
-- la fonction ci-dessous, jamais par la table.
create policy demandes_acces_select on public.demandes_acces
  for select to authenticated
  using (get_my_role() = 'admin'::user_role);

create policy demandes_acces_import on public.demandes_acces
  for insert to authenticated
  with check (get_my_role() = 'admin'::user_role and source = 'import' and statut = 'en_attente');

-- Le formulaire public.
create or replace function public.demander_acces(
  p_prenom text,
  p_nom text,
  p_email text,
  p_organisation text,
  p_fonction text,
  p_role text,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := case when p_role = 'porteur' then 'porteur' else 'partenaire' end;
begin
  if length(btrim(coalesce(p_prenom, ''))) = 0 or length(btrim(coalesce(p_nom, ''))) = 0 then
    raise exception 'Indiquez votre prénom et votre nom.';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Cette adresse e-mail ne semble pas valide.';
  end if;
  if exists (select 1 from public.profiles where lower(email) = v_email) then
    raise exception 'Un compte existe déjà avec cette adresse : connectez-vous, ou utilisez « Mot de passe oublié » auprès de l''équipe.';
  end if;
  if exists (select 1 from public.invitations
              where lower(email) = v_email and statut = 'en_attente' and date_expiration > now()) then
    raise exception 'Votre accès est déjà accordé : le lien pour le créer vous a été envoyé par e-mail (pensez aux courriers indésirables). Sinon, écrivez à l''équipe.';
  end if;

  -- Une demande déjà en attente est mise à jour plutôt que doublée.
  update public.demandes_acces
     set prenom = left(btrim(p_prenom), 80), nom = left(btrim(p_nom), 80),
         organisation = nullif(left(btrim(coalesce(p_organisation, '')), 160), ''),
         fonction = nullif(left(btrim(coalesce(p_fonction, '')), 160), ''),
         role_souhaite = v_role,
         message = nullif(left(btrim(coalesce(p_message, '')), 1000), '')
   where lower(email) = v_email and statut = 'en_attente';
  if found then
    return 'mise_a_jour';
  end if;

  insert into public.demandes_acces (prenom, nom, email, organisation, fonction, role_souhaite, message, source)
  values (
    left(btrim(p_prenom), 80), left(btrim(p_nom), 80), v_email,
    nullif(left(btrim(coalesce(p_organisation, '')), 160), ''),
    nullif(left(btrim(coalesce(p_fonction, '')), 160), ''),
    v_role,
    nullif(left(btrim(coalesce(p_message, '')), 1000), ''),
    'formulaire'
  );

  -- Les administrateurs sont prévenus (et reçoivent un e-mail).
  insert into public.notifications (user_id, type, titre, lien)
  select pr.id, 'demande_acces',
         'Demande d''accès : ' || btrim(p_prenom) || ' ' || btrim(p_nom) || coalesce(' (' || nullif(btrim(coalesce(p_organisation, '')), '') || ')', ''),
         '/admin#acces'
    from public.profiles pr
   where pr.role = 'admin';

  return 'cree';
end;
$$;
grant execute on function public.demander_acces(text, text, text, text, text, text, text) to anon, authenticated;

-- Validation par l'administrateur : une invitation par demande, au rôle choisi.
create or replace function public.valider_demandes_acces(p_ids uuid[], p_roles text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
  d public.demandes_acces%rowtype;
  v_role text;
  v_inv uuid;
  v_n integer := 0;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Seul un administrateur valide les accès.';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  for i in 1 .. array_length(p_ids, 1) loop
    select * into d from public.demandes_acces where id = p_ids[i] and statut = 'en_attente' for update;
    continue when d.id is null;
    v_role := case when p_roles[i] = 'porteur' then 'porteur' else 'partenaire' end;

    if exists (select 1 from public.profiles where lower(email) = lower(d.email)) then
      update public.demandes_acces
         set statut = 'refusee', traite_par = auth.uid(), traite_le = now(),
             message = coalesce(message || E'\n', '') || '[Compte déjà existant]'
       where id = d.id;
      continue;
    end if;

    insert into public.invitations (email, role_cible, id_emetteur, nom, prenom, organisation, date_expiration)
    values (lower(d.email), v_role::public.invitation_role, auth.uid(), d.nom, d.prenom, d.organisation, now() + interval '30 days')
    returning id into v_inv;

    update public.demandes_acces
       set statut = 'validee', role_attribue = v_role, invitation_id = v_inv,
           traite_par = auth.uid(), traite_le = now()
     where id = d.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.valider_demandes_acces(uuid[], text[]) to authenticated;

create or replace function public.refuser_demandes_acces(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Seul un administrateur traite les demandes d''accès.';
  end if;
  update public.demandes_acces
     set statut = 'refusee', traite_par = auth.uid(), traite_le = now()
   where id = any (p_ids) and statut = 'en_attente';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.refuser_demandes_acces(uuid[]) to authenticated;

-- La nouvelle notification « demande_acces » part par e-mail tout de suite.
create or replace function public.courriel_pour_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  v_corps text;
  v_pied text;
begin
  if new.type not in ('demande_accueil', 'message_demande', 'mention', 'tour_vote', 'message_direct',
                      'message_projet', 'message_etape', 'rendez_vous', 'etape_a_valider', 'etape_statut',
                      'demande_acces') then
    return new;
  end if;

  select * into p from public.profiles where id = new.user_id;
  if p.id is null or not p.courriels_actifs or not public.adresse_envoyable(p.email) then
    return new;
  end if;

  if exists (
    select 1 from public.courriels
     where user_id = p.id
       and cle_regroupement = coalesce(new.lien, new.type)
       and created_at > now() - interval '15 minutes'
  ) then
    new.envoye_par_courriel := true;
    return new;
  end if;

  v_corps := case new.type
    when 'demande_accueil' then 'Une nouvelle demande vient d''arriver sur la page de dépôt. Une demande sans réponse est le seul vrai échec du guichet : qui la prend en charge ?'
    when 'message_demande' then 'Répondez depuis la fiche de la demande : le porteur lit votre réponse sur sa page de suivi, et il en est prévenu par e-mail.'
    when 'mention' then 'On vous a mentionné dans la discussion de l''équipe sur une demande.'
    when 'tour_vote' then 'Votre avis est attendu sur cette candidature : favorable, défavorable ou abstention, avec un mot pour expliquer.'
    when 'message_direct' then 'Vous avez reçu un message dans ArcInnoLab.'
    when 'etape_a_valider' then 'Une étape du parcours attend votre validation.'
    when 'demande_acces' then 'Quelqu''un demande un accès à la plateforme. Rien n''est créé tant que vous n''avez pas choisi son rôle et validé, dans l''Administration.'
    else ''
  end;

  v_pied := case when p.role = 'porteur'
    then 'Vous recevez cet e-mail parce que vous êtes accompagné par ArcInnoLab. Vous pouvez couper ces e-mails dans « Mon compte ».'
    else 'Vous recevez cet e-mail parce que vous êtes membre de l''équipe ArcInnoLab. Vous pouvez couper ces e-mails dans votre profil.'
  end;

  insert into public.courriels (destinataire, user_id, categorie, cle_regroupement, sujet, titre, corps, bouton_libelle, bouton_lien, pied)
  values (
    p.email, p.id, 'notification', coalesce(new.lien, new.type),
    left(new.titre, 150),
    new.titre,
    v_corps,
    'Ouvrir dans ArcInnoLab',
    public.parametre('app_url') || coalesce(new.lien, '/'),
    v_pied
  );

  new.envoye_par_courriel := true;
  return new;
end;
$$;
