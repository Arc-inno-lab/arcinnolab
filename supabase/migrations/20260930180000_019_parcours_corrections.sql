-- 019 — Corrections du parcours configurable, après relecture de la 018.
--
-- 1. Les étapes refusées avant la 018 avaient été rangées dans la colonne
--    terminale : elles passaient pour faites. Elles reviennent dans la
--    dernière colonne de travail.
-- 2. Rouvrir une étape validée (le référent la sort de la colonne terminale)
--    efface sa validation : sinon elle resterait « validée » en « En cours ».
-- 3. La dernière colonne de travail ne se supprime pas : sans elle, les
--    étapes n'auraient plus où aller que dans « Terminé ».
-- 4. Les colonnes sont l'outil de l'équipe : le porteur ne les voit pas, il
--    n'a donc pas à pouvoir les renommer ou les supprimer par l'API.
-- 5. La page de suivi sait si le porteur a déjà son accès, pour lui proposer
--    de se connecter plutôt que d'attendre une invitation déjà utilisée.

-- 1 ─────────────────────────────────────────────────────────────────────────
update public.etapes_projet e
set colonne_id = (
  select c.id from public.colonnes_projet c
  where c.projet_id = e.projet_id and not c.terminale
  order by c.ordre desc, c.created_at desc
  limit 1
)
where e.validation = 'refusee'
  and exists (
    select 1 from public.colonnes_projet t
    where t.id = e.colonne_id and t.terminale
  );

-- 2 ─────────────────────────────────────────────────────────────────────────
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
     and new.validation in ('a_valider', 'validee')
     -- Une validation posée dans la même écriture (trancherEtape) est
     -- conservée : seul un simple déplacement rouvre l'étape.
     and new.validation is not distinct from old.validation then
    -- Pour une étape validée, le verrou (proteger_validation_etape, exécuté
    -- ensuite) refuse ce changement à qui n'est pas référent.
    new.validation := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.validation_selon_colonne() from public, anon, authenticated;

-- 3 ─────────────────────────────────────────────────────────────────────────
create or replace function public.avant_suppression_colonne()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  repli uuid;
begin
  -- Suppression en cascade d'un projet entier : rien à protéger.
  if not exists (select 1 from public.projets where id = old.projet_id) then
    return old;
  end if;

  if old.terminale then
    raise exception 'La colonne des étapes terminées ne peut pas être supprimée. Vous pouvez la renommer.';
  end if;

  select id into repli
  from public.colonnes_projet
  where projet_id = old.projet_id and id <> old.id and not terminale
  order by ordre, created_at
  limit 1;

  if repli is null then
    raise exception 'Gardez au moins une colonne de travail avant « Terminé ».';
  end if;

  update public.etapes_projet set colonne_id = repli where colonne_id = old.id;
  return old;
end;
$$;

revoke execute on function public.avant_suppression_colonne() from public, anon, authenticated;

-- 4 ─────────────────────────────────────────────────────────────────────────
drop policy if exists colonnes_write on public.colonnes_projet;

create policy colonnes_write on public.colonnes_projet for all to authenticated
  using (public.get_my_role() = 'admin' or public.is_project_referent(projet_id))
  with check (public.get_my_role() = 'admin' or public.is_project_referent(projet_id));

-- 5 ─────────────────────────────────────────────────────────────────────────
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
  invitation_token uuid,
  a_deja_un_acces boolean
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
      limit 1),
    -- Le porteur fait déjà partie du projet (invitation acceptée, ou compte
    -- existant rattaché directement) : il n'a plus qu'à se connecter.
    exists (
      select 1
      from public.membres_projet m
      join public.profiles pr on pr.id = m.user_id
      where d.projet_id is not null
        and m.projet_id = d.projet_id
        and lower(pr.email) = lower(d.email)
    )
  from public.demandes_accueil d
  left join public.promotions p on p.id = d.promotion_id
  left join public.profiles c on c.id = d.coach_id
  where d.token_suivi = p_token;
$$;

grant execute on function public.get_suivi_demande(uuid) to anon, authenticated;
