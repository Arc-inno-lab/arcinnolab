-- Le passeport devient un parcours configurable, pour l'équipe comme pour le
-- porteur (décision du 30 septembre) :
--
--  1. Chaque projet a ses propres colonnes, que l'on crée, renomme et range
--     comme sur Notion ou ClickUp. Une seule est « terminale » : c'est elle qui
--     dit qu'une étape est faite.
--  2. La validation par le référent se détache de la colonne. Elle devient un
--     attribut de l'étape (à valider, validée, refusée) : sans cela, des
--     colonnes libres n'auraient plus nulle part où loger ce verrou.
--  3. Le parcours ne contient plus seulement des étapes : aussi des
--     rendez-vous (proposés par l'un, confirmés par l'autre) et des documents
--     à fournir.
--  4. La page de suivi du porteur nomme désormais la personne qui s'occupe de
--     lui, et lui ouvre son espace projet dès qu'il est admis.

-- ── 1. Colonnes propres à chaque projet ─────────────────────────────────────
create table public.colonnes_projet (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  nom text not null check (length(btrim(nom)) between 1 and 60),
  ordre integer not null default 0,
  terminale boolean not null default false,
  created_at timestamptz not null default now()
);

create index colonnes_projet_projet_idx on public.colonnes_projet (projet_id, ordre);

-- Une seule colonne « terminée » par projet : c'est le repère commun qui
-- permet de dire qu'une étape est faite, quels que soient les noms choisis.
create unique index colonnes_une_terminale
  on public.colonnes_projet (projet_id) where terminale;

alter table public.colonnes_projet enable row level security;

create policy colonnes_select on public.colonnes_projet for select to authenticated
  using (
    public.get_my_role() in ('admin', 'partenaire')
    or public.is_project_member(projet_id)
  );

create policy colonnes_write on public.colonnes_projet for all to authenticated
  using (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or public.is_project_member(projet_id)
  )
  with check (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or public.is_project_member(projet_id)
  );

-- Supprimer une colonne ne doit jamais faire disparaître d'étapes : elles
-- rejoignent la première colonne restante. La colonne terminale, elle, ne se
-- supprime pas — elle se renomme.
create or replace function public.avant_suppression_colonne()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  repli uuid;
begin
  if old.terminale and exists (select 1 from public.projets where id = old.projet_id) then
    raise exception 'La colonne des étapes terminées ne peut pas être supprimée. Vous pouvez la renommer.';
  end if;

  select id into repli
  from public.colonnes_projet
  where projet_id = old.projet_id and id <> old.id and not terminale
  order by ordre, created_at
  limit 1;

  update public.etapes_projet set colonne_id = repli where colonne_id = old.id;
  return old;
end;
$$;

revoke execute on function public.avant_suppression_colonne() from public, anon, authenticated;

create trigger colonnes_avant_suppression
  before delete on public.colonnes_projet
  for each row execute function public.avant_suppression_colonne();

-- Tout projet naît avec trois colonnes, que chacun renomme à sa guise.
create or replace function public.colonnes_par_defaut()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.colonnes_projet (projet_id, nom, ordre, terminale) values
    (new.id, 'À faire', 0, false),
    (new.id, 'En cours', 1, false),
    (new.id, 'Terminé', 2, true);
  return new;
end;
$$;

revoke execute on function public.colonnes_par_defaut() from public, anon, authenticated;

create trigger projets_colonnes_par_defaut
  after insert on public.projets
  for each row execute function public.colonnes_par_defaut();

-- Les projets existants reçoivent les mêmes trois colonnes.
insert into public.colonnes_projet (projet_id, nom, ordre, terminale)
select p.id, c.nom, c.ordre, c.terminale
from public.projets p
cross join (values ('À faire', 0, false), ('En cours', 1, false), ('Terminé', 2, true))
  as c(nom, ordre, terminale)
where not exists (select 1 from public.colonnes_projet x where x.projet_id = p.id);

-- ── 2 et 3. L'étape : type, colonne, validation, rendez-vous ────────────────
create type public.element_parcours as enum ('etape', 'rendez_vous', 'document');
create type public.validation_etape as enum ('a_valider', 'validee', 'refusee');
create type public.statut_rdv as enum ('propose', 'confirme', 'annule');

alter table public.etapes_projet
  add column type public.element_parcours not null default 'etape',
  add column colonne_id uuid references public.colonnes_projet(id) on delete set null,
  add column validation public.validation_etape,
  add column rdv_debut timestamptz,
  add column rdv_mode text check (rdv_mode in ('visio', 'telephone', 'sur_place')),
  add column rdv_lieu text,
  add column rdv_statut public.statut_rdv,
  add column rdv_avec uuid references public.profiles(id) on delete set null,
  add column cree_par uuid references public.profiles(id) on delete set null default auth.uid();

create index etapes_projet_colonne_idx on public.etapes_projet (colonne_id);

-- Un rendez-vous a une date et un statut ; une étape n'en a pas.
alter table public.etapes_projet add constraint rdv_complet check (
  type <> 'rendez_vous' or (rdv_debut is not null and rdv_statut is not null)
);

-- Reprise des étapes existantes : l'ancien statut dit à la fois la colonne et
-- la validation ; on les sépare.
update public.etapes_projet e
set colonne_id = c.id,
    validation = case e.statut
      when 'validee' then 'validee'::public.validation_etape
      when 'refusee' then 'refusee'::public.validation_etape
      else null end
from public.colonnes_projet c
where c.projet_id = e.projet_id
  and e.colonne_id is null
  and c.ordre = case e.statut when 'a_faire' then 0 when 'en_cours' then 1 else 2 end;

-- Déposer une étape dans la colonne terminale la soumet au référent ; l'en
-- sortir retire la demande. C'est ce qui permet au porteur de dire « c'est
-- fait » d'un seul geste, sans jamais pouvoir valider à la place du référent.
create or replace function public.validation_selon_colonne()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vers_terminale boolean;
  depuis_terminale boolean;
begin
  if new.type = 'rendez_vous' then
    return new;
  end if;

  select coalesce(bool_or(terminale), false) into vers_terminale
  from public.colonnes_projet where id = new.colonne_id;

  if tg_op = 'UPDATE' then
    select coalesce(bool_or(terminale), false) into depuis_terminale
    from public.colonnes_projet where id = old.colonne_id;
  else
    depuis_terminale := false;
  end if;

  if vers_terminale and not depuis_terminale
     and new.validation is distinct from 'validee' then
    new.validation := 'a_valider';
  elsif depuis_terminale and not vers_terminale
     and new.validation = 'a_valider' then
    new.validation := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.validation_selon_colonne() from public, anon, authenticated;

create trigger etapes_auto_validation
  before insert or update of colonne_id on public.etapes_projet
  for each row execute function public.validation_selon_colonne();

-- Le verrou de validation, réécrit pour porter sur la validation elle-même et
-- non plus sur la colonne. Le nom du trigger est conservé : il s'exécute après
-- `etapes_auto_validation` (ordre alphabétique), donc sur la valeur finale.
create or replace function public.proteger_validation_etape()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() = 'admin' or public.is_project_referent(new.projet_id) then
    return new;
  end if;

  if new.validation is distinct from old.validation then
    if new.validation = 'validee' or new.validation = 'refusee' then
      raise exception 'Seul le partenaire référent peut valider ou refuser une étape.';
    end if;
    if old.validation = 'validee' then
      raise exception 'Cette étape a été validée par le référent : elle ne peut plus être rouverte.';
    end if;
  end if;

  if old.validation = 'validee' and new.colonne_id is distinct from old.colonne_id then
    raise exception 'Cette étape a été validée par le référent : elle ne peut plus être déplacée.';
  end if;

  if new.avis is distinct from old.avis
     or new.id_partenaire_validateur is distinct from old.id_partenaire_validateur
     or new.date_validation is distinct from old.date_validation then
    raise exception 'L''avis du partenaire ne peut être modifié que par lui.';
  end if;

  return new;
end;
$$;

-- Le porteur supprime ce qu'il a créé ou ce qui n'a pas encore été tranché ;
-- une étape validée reste, c'est la trace de l'accompagnement.
drop policy if exists etapes_projet_delete on public.etapes_projet;
create policy etapes_projet_delete on public.etapes_projet for delete to authenticated
  using (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or (public.is_project_member(projet_id) and validation is distinct from 'validee')
  );

-- ── 4. La page de suivi du porteur ──────────────────────────────────────────
-- Elle nomme désormais son interlocuteur (un porteur écrit plus volontiers à
-- « César » qu'à « l'équipe »), et, une fois la candidature admise, lui remet
-- son invitation : son lien de suivi prouve déjà qu'il est bien le porteur,
-- inutile de lui faire attendre un second lien transmis à la main.
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
  instruction_echeance timestamptz,
  coach_prenom text,
  coach_nom text,
  invitation_token uuid
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
      where t.demande_id = d.id and t.statut in ('en_cours', 'complet')),
    c.prenom,
    c.nom,
    (select i.token from public.invitations i
      where d.projet_id is not null
        and i.projet_id = d.projet_id
        and lower(i.email) = lower(d.email)
        and i.statut = 'en_attente'
        and i.date_expiration > now()
      order by i.date_envoi desc
      limit 1)
  from public.demandes_accueil d
  left join public.promotions p on p.id = d.promotion_id
  left join public.profiles c on c.id = d.coach_id
  where d.token_suivi = p_token;
$$;

-- Les messages du fil, avec le prénom de l'équipier qui a écrit.
drop function if exists public.get_messages_suivi(uuid);

create function public.get_messages_suivi(p_token uuid)
returns table (
  auteur public.auteur_message,
  contenu text,
  envoye_le timestamptz,
  auteur_prenom text
)
language sql
security definer
set search_path = public
stable
as $$
  select m.auteur, m.contenu, m.created_at, pr.prenom
  from public.messages_demande m
  join public.demandes_accueil d on d.id = m.demande_id
  left join public.profiles pr on pr.id = m.auteur_id
  where d.token_suivi = p_token
  order by m.created_at;
$$;
