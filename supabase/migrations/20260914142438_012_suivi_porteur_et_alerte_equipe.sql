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
