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
