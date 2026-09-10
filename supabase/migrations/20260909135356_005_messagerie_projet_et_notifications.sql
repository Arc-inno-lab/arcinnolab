-- Messagerie de projet : fil de discussion visible par tous les membres d'un projet
-- (porteurs rattachés + tous les partenaires/admin, cohérent avec la transparence déjà en place
-- sur le reste des données projet). Remplace/complète la table "messages" 1-1 du schéma initial,
-- qui ne convient pas à un fil de groupe par projet.
create table public.messages_projet (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projets(id) on delete cascade,
  auteur_id uuid not null references public.profiles(id),
  contenu text not null,
  created_at timestamptz not null default now()
);

alter table public.messages_projet enable row level security;

create policy messages_projet_select on public.messages_projet
  for select
  using (
    get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
    or is_project_member(projet_id)
  );

create policy messages_projet_insert on public.messages_projet
  for insert
  with check (
    auteur_id = auth.uid()
    and (
      get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role])
      or is_project_member(projet_id)
    )
  );

-- Notifications in-app : nouvelle étape, étape validée/refusée, nouveau message.
-- V0 : n'importe quel utilisateur authentifié peut créer une notification pour un autre
-- (plateforme fermée, usage interne uniquement) — le contenu reste géré par les server actions.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  titre text not null,
  lien text,
  lu boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select
  using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update
  using (user_id = auth.uid());

create policy notifications_insert on public.notifications
  for insert
  to authenticated
  with check (true);

create index notifications_user_unread_idx on public.notifications (user_id, lu, created_at desc);
create index messages_projet_projet_idx on public.messages_projet (projet_id, created_at);
