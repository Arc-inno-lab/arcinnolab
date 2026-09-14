-- Instruction collégiale d'une candidature : le tour de vote.
--
-- Rôle retenu : le vote PRÉPARE le comité, il ne décide pas à sa place. Les
-- partenaires instruisent le dossier en cinq jours ; le comité mixte reste
-- l'instance qui tranche. L'application matérialise cette distinction — un
-- tour clos ne change pas le statut de la demande, il produit un avis.
--
-- Règle retenue : tous les partenaires doivent se prononcer. Elle est la plus
-- légitime, mais elle a un défaut connu : un partenaire absent bloquerait le
-- porteur indéfiniment. D'où la clôture sur constat d'absence, ouverte à
-- l'admin une fois l'échéance passée, et qui laisse trace des non-réponses.

create type public.vote_position as enum ('favorable', 'defavorable', 'abstention');

create type public.tour_statut as enum (
  'en_cours',   -- dans les cinq jours, tout le monde n'a pas voté
  'complet',    -- tous les votants attendus se sont prononcés
  'clos',       -- clos par l'admin (à l'échéance, ou après complétude)
  'abandonne'   -- annulé sans suite
);

-- ── Tours de vote ───────────────────────────────────────────────────────────
create table public.tours_vote (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_accueil(id) on delete cascade,
  promotion_id uuid references public.promotions(id) on delete set null,

  ouvert_par uuid references public.profiles(id) on delete set null,
  ouvert_le timestamptz not null default now(),
  -- Cinq jours pleins. Stockée et non recalculée : si la règle change un jour,
  -- les tours déjà ouverts gardent l'échéance annoncée à leurs votants.
  date_limite timestamptz not null default (now() + interval '5 days'),

  statut public.tour_statut not null default 'en_cours',
  clos_le timestamptz,
  clos_par uuid references public.profiles(id) on delete set null,

  -- Nombre de personnes attendues, figé à l'ouverture : si un partenaire
  -- rejoint la plateforme pendant le tour, il ne doit pas rendre soudainement
  -- incomplet un tour qui ne l'était pas.
  votants_attendus integer not null default 0,

  -- Synthèse des avis, destinée à l'instruction interne.
  synthese text,
  synthese_le timestamptz,
  synthese_par_ia boolean not null default false,

  created_at timestamptz not null default now()
);

create index tours_demande_idx on public.tours_vote (demande_id, created_at desc);
create index tours_statut_idx on public.tours_vote (statut, date_limite);

alter table public.tours_vote enable row level security;

create policy tours_select on public.tours_vote
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy tours_insert on public.tours_vote
  for insert to authenticated
  with check (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create policy tours_update on public.tours_vote
  for update to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

-- ── Votes ───────────────────────────────────────────────────────────────────
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours_vote(id) on delete cascade,
  votant_id uuid not null references public.profiles(id) on delete cascade,
  position public.vote_position not null,
  motif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tour_id, votant_id),

  -- Un avis défavorable sans motif est inexploitable : ni pour le porteur, à
  -- qui l'on doit une explication, ni pour les autres partenaires, qui doivent
  -- pouvoir en débattre. La contrainte est posée ici plutôt que dans
  -- l'interface : c'est une règle de fond, pas une validation de formulaire.
  constraint vote_defavorable_motive check (
    position <> 'defavorable' or (motif is not null and length(btrim(motif)) >= 10)
  )
);

create index votes_tour_idx on public.votes (tour_id);

alter table public.votes enable row level security;

-- Les avis sont visibles de toute l'équipe : c'est une instruction collégiale,
-- pas un scrutin secret. Chacun doit pouvoir lire les arguments des autres.
create policy votes_select on public.votes
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

-- On ne vote que pour soi, et seulement tant que le tour est ouvert.
create policy votes_insert on public.votes
  for insert to authenticated
  with check (
    votant_id = auth.uid()
    and get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
    and exists (
      select 1 from public.tours_vote t
      where t.id = tour_id and t.statut in ('en_cours', 'complet')
    )
  );

create policy votes_update on public.votes
  for update to authenticated
  using (
    votant_id = auth.uid()
    and exists (
      select 1 from public.tours_vote t
      where t.id = tour_id and t.statut in ('en_cours', 'complet')
    )
  );

-- ── Ce que lit le porteur ───────────────────────────────────────────────────
-- Le message communiqué est distinct des motifs de vote : ceux-ci sont écrits
-- entre professionnels et tombent souvent mal quand ils sont lus par la
-- personne concernée. L'admin valide toujours ce qui part.
alter table public.demandes_accueil
  add column if not exists message_porteur text;

comment on column public.demandes_accueil.message_porteur is
  'Message communiqué au porteur avec la décision. Validé par un humain avant '
  'publication, même lorsqu''il a été rédigé automatiquement.';

-- ── Passage à l'état « en instruction » ─────────────────────────────────────
alter type public.demande_statut add value if not exists 'en_instruction' after 'en_attente_comite';
