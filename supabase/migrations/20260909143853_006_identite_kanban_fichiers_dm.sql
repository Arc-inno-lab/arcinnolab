-- Identité visuelle (logos/avatars), sous-fils par étape, fiche porteur enrichie, messagerie directe.

alter table public.profiles add column if not exists photo_url text;
alter table public.projets add column if not exists logo_url text;
alter table public.invitations add column if not exists nom text;
alter table public.invitations add column if not exists prenom text;
alter table public.invitations add column if not exists organisation text;

-- Pièces jointes rattachables à une étape précise (en plus du projet global).
alter table public.documents add column if not exists etape_id uuid references public.etapes_projet(id) on delete cascade;
create index if not exists documents_etape_idx on public.documents(etape_id);

-- Sous-fil de discussion par étape : on réutilise messages_projet (mêmes droits, membres du projet),
-- simplement filtré par etape_id quand non nul.
alter table public.messages_projet add column if not exists etape_id uuid references public.etapes_projet(id) on delete cascade;
create index if not exists messages_projet_etape_idx on public.messages_projet(etape_id);

-- Index pour la messagerie directe (table "messages" déjà créée avec RLS dans le schéma initial).
create index if not exists messages_expediteur_idx on public.messages(expediteur_id, date_envoi);
create index if not exists messages_destinataire_idx on public.messages(destinataire_id, date_envoi);

-- Bucket de stockage unique pour logos de projet, avatars et pièces jointes.
-- Lecture publique (assets non confidentiels par défaut, cohérent avec le modèle "plateforme
-- fermée à accès nominatif" déjà utilisé pour les notifications) ; écriture réservée aux
-- utilisateurs authentifiés, modification/suppression réservées au propriétaire du fichier.
insert into storage.buckets (id, name, public)
values ('arcinnolab-media', 'arcinnolab-media', true)
on conflict (id) do nothing;

drop policy if exists arcinnolab_media_public_read on storage.objects;
create policy arcinnolab_media_public_read on storage.objects
  for select using (bucket_id = 'arcinnolab-media');

drop policy if exists arcinnolab_media_authenticated_insert on storage.objects;
create policy arcinnolab_media_authenticated_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'arcinnolab-media');

drop policy if exists arcinnolab_media_owner_update on storage.objects;
create policy arcinnolab_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'arcinnolab-media' and owner = auth.uid());

drop policy if exists arcinnolab_media_owner_delete on storage.objects;
create policy arcinnolab_media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'arcinnolab-media' and owner = auth.uid());
