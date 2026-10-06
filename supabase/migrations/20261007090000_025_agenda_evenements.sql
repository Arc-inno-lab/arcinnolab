-- 025 · L'agenda des événements ArcInnoLab.
--
-- Ateliers, challenges, conférences, permanences : l'équipe les publie, tout le
-- monde les consulte. Un événement « public » apparaît aussi sur la page de
-- dépôt (vitrine), visible sans compte ; les autres sont réservés aux membres
-- connectés (équipe et porteurs). Pas d'inscription : la fiche donne le lieu,
-- l'horaire, un lien éventuel, et un fichier pour l'ajouter à son agenda.
--
-- Pas de suppression : un événement se « retire » (masqué partout) ou
-- s'« annule » (laissé visible, barré, pour que ceux qui l'avaient noté le
-- sachent).

create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (length(btrim(titre)) between 3 and 160),
  description text check (description is null or length(description) <= 4000),
  debut timestamptz not null,
  fin timestamptz,
  lieu text check (lieu is null or length(lieu) <= 200),
  lien text check (lien is null or (lien ~* '^https?://' and length(lien) <= 500)),
  organisateur text check (organisateur is null or length(organisateur) <= 120),
  public boolean not null default true,
  annule boolean not null default false,
  retire boolean not null default false,
  cree_par uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evenements_fin_apres_debut check (fin is null or fin > debut)
);

create index if not exists evenements_debut_idx on public.evenements (debut) where not retire;

alter table public.evenements enable row level security;

-- Visiteurs sans compte : les événements publics seulement.
create policy evenements_select_public on public.evenements
  for select to anon
  using (public and not retire);

-- Membres connectés (équipe et porteurs) : tout ce qui n'est pas retiré.
create policy evenements_select_membres on public.evenements
  for select to authenticated
  using (not retire or get_my_role() = 'admin'::user_role or cree_par = auth.uid());

create policy evenements_insert on public.evenements
  for insert to authenticated
  with check (
    get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
    and cree_par = auth.uid()
  );

-- L'auteur modifie les siens ; l'administrateur, tous.
create policy evenements_update on public.evenements
  for update to authenticated
  using (get_my_role() = 'admin'::user_role or (get_my_role() = 'partenaire'::user_role and cree_par = auth.uid()))
  with check (get_my_role() = 'admin'::user_role or (get_my_role() = 'partenaire'::user_role and cree_par = auth.uid()));

create or replace function public.touch_evenement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger evenements_touch
  before update on public.evenements
  for each row execute function public.touch_evenement();
