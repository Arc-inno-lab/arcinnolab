-- 021 — Qualification des demandes, fil interne de l'équipe, promotions.

-- ── Qualification ──────────────────────────────────────────────────────────
-- Un partenaire qualifie la demande : colle-t-elle à l'ADN d'ArcInnoLab ?
-- Puis il choisit la suite (refus, orientation, vote) ; ces suites existent
-- déjà sous forme de statuts, d'orientations et de tours de vote.
alter table public.demandes_accueil
  add column if not exists adn_arcinnolab boolean,
  add column if not exists qualifie_par uuid references public.profiles (id) on delete set null,
  add column if not exists qualifie_le timestamptz,
  add column if not exists persona_precision text
    check (persona_precision is null or length(persona_precision) <= 200);

-- ── Fil interne de l'équipe ────────────────────────────────────────────────
-- Discussion entre membres de l'équipe sur une demande, avec mentions. Le
-- porteur n'y a jamais accès : ni la page de suivi ni aucune fonction
-- publique ne lit cette table.
create table if not exists public.notes_demande (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_accueil (id) on delete cascade,
  auteur_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  contenu text not null check (length(btrim(contenu)) between 1 and 4000),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists notes_demande_demande_idx on public.notes_demande (demande_id, created_at);

alter table public.notes_demande enable row level security;

create policy notes_demande_select on public.notes_demande for select to authenticated
  using (public.get_my_role() in ('admin', 'partenaire'));

create policy notes_demande_insert on public.notes_demande for insert to authenticated
  with check (auteur_id = auth.uid() and public.get_my_role() in ('admin', 'partenaire'));

create policy notes_demande_delete on public.notes_demande for delete to authenticated
  using (auteur_id = auth.uid() or public.get_my_role() = 'admin');

-- ── Promotions ─────────────────────────────────────────────────────────────
alter table public.promotions
  add column if not exists description text,
  add column if not exists date_debut date,
  add column if not exists date_fin date,
  add column if not exists places integer check (places is null or places between 1 and 500);
