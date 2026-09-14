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
