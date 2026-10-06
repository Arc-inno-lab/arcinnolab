-- 026 · Les e-mails, envoyés depuis l'adresse gmail d'ArcInnoLab.
--
-- Principe : rien n'est envoyé depuis la base. Chaque e-mail à partir est
-- d'abord écrit dans une file (`courriels`), puis une fonction Supabase
-- (`supabase/functions/courriels`) la vide en passant par le serveur SMTP de
-- Gmail. La base la prévient à chaque ajout (pg_net) et la relance toutes les
-- 10 minutes (pg_cron), au cas où un envoi aurait échoué.
--
-- Qui reçoit quoi :
--   · l'équipe et les porteurs qui ont un compte : tout de suite pour ce qui
--     appelle une réponse (nouvelle demande, message, mention, avis attendu,
--     étape à valider, rendez-vous) ; le reste dans un récap le matin, du
--     lundi au vendredi. Chacun peut couper ses e-mails dans son profil.
--   · les porteurs sans compte (page de suivi) : accusé de dépôt avec leur
--     lien, réponse de l'équipe, et chaque étape décisive de leur demande.
--
-- Garde-fous : pas deux e-mails immédiats sur le même fil en moins de
-- 15 minutes ; les adresses fictives (example.*, .test) sont ignorées ; un
-- e-mail qui n'a pas pu partir en 24 heures est abandonné (pas de rafale
-- d'e-mails périmés le jour où l'envoi est enfin configuré).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ── Réglages non secrets ────────────────────────────────────────────────────
create table if not exists public.parametres (
  cle text primary key,
  valeur text not null
);
alter table public.parametres enable row level security;
-- Aucune policy : lus par les fonctions ci-dessous seulement.

insert into public.parametres (cle, valeur) values
  ('app_url', 'https://arcinnolab-five.vercel.app'),
  ('url_fonction_courriels', 'https://poewilykmxwpxqvkrrjq.supabase.co/functions/v1/courriels')
on conflict (cle) do nothing;

create or replace function public.parametre(p_cle text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select valeur from public.parametres where cle = p_cle;
$$;
revoke execute on function public.parametre(text) from public, anon, authenticated;

-- ── Préférence de chacun ────────────────────────────────────────────────────
alter table public.profiles add column if not exists courriels_actifs boolean not null default true;

-- Une notification déjà partie par e-mail (immédiat ou récap) ne repart pas.
alter table public.notifications add column if not exists envoye_par_courriel boolean not null default false;

-- ── La file ─────────────────────────────────────────────────────────────────
create table if not exists public.courriels (
  id uuid primary key default gen_random_uuid(),
  destinataire text not null,
  user_id uuid references public.profiles(id) on delete set null,
  demande_id uuid references public.demandes_accueil(id) on delete set null,
  categorie text not null check (categorie in ('notification', 'recap', 'porteur')),
  -- Deux e-mails immédiats de même clé (même fil) ne partent pas à moins de 15 minutes.
  cle_regroupement text,
  sujet text not null,
  titre text not null,
  corps text not null default '',
  bouton_libelle text,
  bouton_lien text,
  items jsonb not null default '[]'::jsonb,
  pied text not null default '',
  statut text not null default 'a_envoyer' check (statut in ('a_envoyer', 'en_cours', 'envoye', 'echec', 'abandonne', 'ignore')),
  essais integer not null default 0,
  erreur text,
  created_at timestamptz not null default now(),
  envoye_le timestamptz
);
create index if not exists courriels_file_idx on public.courriels (statut, created_at);
create index if not exists courriels_cle_idx on public.courriels (cle_regroupement, created_at);
alter table public.courriels enable row level security;
-- Aucune policy : seuls les fonctions et le rôle de service y touchent.

-- Les adresses de démonstration (example.org, .test…) ne reçoivent rien.
create or replace function public.adresse_envoyable(p text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p is not null
     and p ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and p !~* '@(.+\.)?example\.(com|org|net|ch|fr)$'
     and p !~* '\.(test|invalid|localhost|example)$';
$$;

-- ── Prévenir la fonction d'envoi ────────────────────────────────────────────
create or replace function public.reveiller_envoi_courriels()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := public.parametre('url_fonction_courriels');
begin
  if v_url is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;
revoke execute on function public.reveiller_envoi_courriels() from public, anon, authenticated;

create or replace function public.apres_ajout_courriels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reveiller_envoi_courriels();
  return null;
end;
$$;

create trigger courriels_reveiller
  after insert on public.courriels
  for each statement execute function public.apres_ajout_courriels();

-- Relance périodique : seulement s'il reste quelque chose à envoyer.
create or replace function public.relancer_courriels()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.courriels
     where (statut = 'a_envoyer' or (statut = 'echec' and essais < 3))
       and created_at > now() - interval '24 hours'
  ) then
    perform public.reveiller_envoi_courriels();
  end if;
end;
$$;
revoke execute on function public.relancer_courriels() from public, anon, authenticated;

-- ── Ce que la fonction d'envoi appelle (rôle de service uniquement) ─────────
create or replace function public.reserver_courriels(n integer default 20)
returns setof public.courriels
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trop vieux pour avoir encore un sens : abandonné.
  update public.courriels
     set statut = 'abandonne', erreur = coalesce(erreur, 'Non envoyé dans les 24 heures')
   where statut in ('a_envoyer', 'echec', 'en_cours')
     and created_at <= now() - interval '24 hours';

  return query
  update public.courriels c
     set statut = 'en_cours', essais = c.essais + 1
   where c.id in (
     select id from public.courriels
      where statut = 'a_envoyer'
         or (statut = 'echec' and essais < 3)
         -- Un envoi interrompu (fonction arrêtée en route) est repris après 10 minutes.
         or (statut = 'en_cours' and created_at < now() - interval '10 minutes' and essais < 3)
      order by created_at
      limit greatest(1, least(n, 50))
      for update skip locked
   )
  returning c.*;
end;
$$;
revoke execute on function public.reserver_courriels(integer) from public, anon, authenticated;
grant execute on function public.reserver_courriels(integer) to service_role;

create or replace function public.marquer_courriel(p_id uuid, p_ok boolean, p_erreur text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.courriels
     set statut = case when p_ok then 'envoye' else 'echec' end,
         envoye_le = case when p_ok then now() else envoye_le end,
         erreur = case when p_ok then null else left(p_erreur, 500) end
   where id = p_id;
$$;
revoke execute on function public.marquer_courriel(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.marquer_courriel(uuid, boolean, text) to service_role;

-- ── Équipe et porteurs avec compte : une notification → un e-mail ──────────
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
  -- Seulement ce qui appelle une réponse ; le reste attend le récap du matin.
  if new.type not in ('demande_accueil', 'message_demande', 'mention', 'tour_vote', 'message_direct',
                      'message_projet', 'message_etape', 'rendez_vous', 'etape_a_valider', 'etape_statut') then
    return new;
  end if;

  select * into p from public.profiles where id = new.user_id;
  if p.id is null or not p.courriels_actifs or not public.adresse_envoyable(p.email) then
    return new;
  end if;

  -- Même fil, moins de 15 minutes : la notification reste dans l'appli, pas de second e-mail.
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

create trigger notifications_courriel
  before insert on public.notifications
  for each row execute function public.courriel_pour_notification();

-- ── Le récap du matin ───────────────────────────────────────────────────────
create or replace function public.preparer_recap_quotidien()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  v_items jsonb;
  v_n integer;
  v_total integer := 0;
  v_app text := public.parametre('app_url');
begin
  for p in
    select pr.id, pr.email, pr.prenom, pr.role
      from public.profiles pr
     where pr.courriels_actifs and public.adresse_envoyable(pr.email)
  loop
    select coalesce(jsonb_agg(jsonb_build_object('texte', n.titre, 'lien', v_app || coalesce(n.lien, '/')) order by n.created_at), '[]'::jsonb),
           count(*)
      into v_items, v_n
      from public.notifications n
     where n.user_id = p.id
       and not n.lu
       and not n.envoye_par_courriel
       and n.created_at > now() - interval '7 days';

    if v_n > 0 then
      insert into public.courriels (destinataire, user_id, categorie, sujet, titre, corps, bouton_libelle, bouton_lien, items, pied)
      values (
        p.email, p.id, 'recap',
        'Votre récap ArcInnoLab : ' || v_n || case when v_n > 1 then ' nouveautés' else ' nouveauté' end,
        'Bonjour ' || p.prenom || ', voici ce qui s''est passé',
        'Les nouveautés que vous n''avez pas encore vues :',
        case when p.role = 'porteur' then 'Ouvrir mon projet' else 'Voir ce qui m''attend' end,
        v_app || case when p.role = 'porteur' then '/mon-projet' else '/' end,
        v_items,
        'Un récap par jour ouvré, seulement s''il y a du nouveau. Vous pouvez couper ces e-mails dans votre profil.'
      );
      update public.notifications
         set envoye_par_courriel = true
       where user_id = p.id and not lu and not envoye_par_courriel and created_at > now() - interval '7 days';
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;
revoke execute on function public.preparer_recap_quotidien() from public, anon, authenticated;

-- ── Porteurs sans compte : leur demande ─────────────────────────────────────
create or replace function public.courriel_porteur(
  p_demande public.demandes_accueil,
  p_sujet text,
  p_titre text,
  p_corps text,
  p_cle text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.adresse_envoyable(p_demande.email) then
    return;
  end if;
  if p_cle is not null and exists (
    select 1 from public.courriels
     where cle_regroupement = p_cle and created_at > now() - interval '15 minutes'
  ) then
    return;
  end if;
  insert into public.courriels (destinataire, demande_id, categorie, cle_regroupement, sujet, titre, corps, bouton_libelle, bouton_lien, pied)
  values (
    p_demande.email, p_demande.id, 'porteur', p_cle, p_sujet, p_titre, p_corps,
    'Suivre ma demande',
    public.parametre('app_url') || '/suivi/' || p_demande.token_suivi::text,
    'Ce lien est personnel : il vous donne accès à votre demande sans mot de passe. Pour écrire à l''équipe, passez par cette page plutôt que de répondre à cet e-mail.'
  );
end;
$$;
revoke execute on function public.courriel_porteur(public.demandes_accueil, text, text, text, text) from public, anon, authenticated;

-- Dépôt : l'accusé de réception, avec le lien de suivi.
create or replace function public.courriel_depot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.courriel_porteur(
    new,
    'Votre demande ArcInnoLab est bien arrivée',
    'Bonjour ' || new.prenom || ', merci pour votre demande',
    'Nous avons bien reçu « ' || new.titre_projet || ' ». Un membre de l''équipe ArcInnoLab va prendre contact avec vous. '
      || 'Gardez cet e-mail : le bouton ci-dessous vous permet de suivre votre demande, d''écrire à l''équipe et d''ajouter des documents.'
  );
  return new;
end;
$$;

create trigger demandes_courriel_depot
  after insert on public.demandes_accueil
  for each row execute function public.courriel_depot();

-- Réponse de l'équipe sur le fil de suivi.
create or replace function public.courriel_reponse_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes_accueil%rowtype;
  v_qui text;
begin
  if new.auteur <> 'equipe' then
    return new;
  end if;
  select * into d from public.demandes_accueil where id = new.demande_id;
  select prenom into v_qui from public.profiles where id = new.auteur_id;
  perform public.courriel_porteur(
    d,
    coalesce(v_qui, 'L''équipe ArcInnoLab') || ' vous a répondu',
    coalesce(v_qui, 'L''équipe ArcInnoLab') || ' vous a écrit',
    '« ' || case when length(new.contenu) > 400 then left(new.contenu, 400) || '…' else new.contenu end || ' »'
      || E'\n\n' || 'Lisez la suite et répondez depuis votre page de suivi.',
    'suivi-' || d.id::text
  );
  return new;
end;
$$;

create trigger messages_demande_courriel
  after insert on public.messages_demande
  for each row execute function public.courriel_reponse_equipe();

-- Les étapes qui comptent pour le porteur.
create or replace function public.courriel_etape_demande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach text;
  v_sujet text;
  v_corps text;
begin
  if new.statut is not distinct from old.statut then
    return new;
  end if;
  select prenom into v_coach from public.profiles where id = new.coach_id;

  if new.statut = 'en_qualification' and old.statut = 'nouvelle' then
    v_sujet := 'Votre demande est prise en charge';
    v_corps := coalesce(v_coach, 'Un membre de l''équipe') || ' s''occupe de votre demande et va vous contacter pour un premier échange.';
  elsif new.statut = 'en_instruction' then
    v_sujet := 'Votre candidature est à l''étude';
    v_corps := 'Les partenaires d''ArcInnoLab examinent votre candidature. La décision vous sera communiquée sur votre page de suivi.';
  elsif new.statut = 'en_attente_comite' then
    v_sujet := 'Votre candidature ira au comité';
    v_corps := 'Votre projet sera examiné par le comité mixte franco-suisse. Les détails sont sur votre page de suivi.';
  elsif new.statut = 'orientee' then
    v_sujet := 'Nous vous avons mis en relation';
    v_corps := 'L''équipe vous a orienté vers une structure dont le travail correspond à votre projet. Retrouvez qui contacter sur votre page de suivi.';
  elsif new.statut = 'admise' then
    v_sujet := 'Bonne nouvelle : votre projet est retenu';
    v_corps := 'Votre projet rejoint l''accompagnement ArcInnoLab. Créez votre accès à votre espace projet depuis votre page de suivi.';
  elsif new.statut = 'non_retenue' then
    v_sujet := 'Réponse à votre demande ArcInnoLab';
    v_corps := 'La réponse de l''équipe et ses motifs sont sur votre page de suivi. Votre accompagnateur reste joignable pour vous orienter.';
  else
    return new;
  end if;

  perform public.courriel_porteur(new, v_sujet, 'Bonjour ' || new.prenom, v_corps || E'\n\n' || 'Votre demande : « ' || new.titre_projet || ' ».');
  return new;
end;
$$;

create trigger demandes_courriel_etape
  after update of statut on public.demandes_accueil
  for each row execute function public.courriel_etape_demande();

-- Les fonctions de déclencheur ne s'appellent pas directement.
revoke execute on function public.courriel_pour_notification() from public, anon, authenticated;
revoke execute on function public.courriel_depot() from public, anon, authenticated;
revoke execute on function public.courriel_reponse_equipe() from public, anon, authenticated;
revoke execute on function public.courriel_etape_demande() from public, anon, authenticated;
revoke execute on function public.apres_ajout_courriels() from public, anon, authenticated;

-- ── Planification ───────────────────────────────────────────────────────────
-- Relance toutes les 10 minutes ; récap à 6 h UTC (7 h ou 8 h à Paris), du lundi au vendredi.
select cron.schedule('courriels-relance', '*/10 * * * *', $$select public.relancer_courriels()$$);
select cron.schedule('courriels-recap', '0 6 * * 1-5', $$select public.preparer_recap_quotidien()$$);
