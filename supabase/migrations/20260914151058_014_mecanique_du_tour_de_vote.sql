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
