-- 024 · Le porteur complète sa demande, et l'équipe en est vraiment prévenue.
--
-- 1. Depuis sa page de suivi (sans compte, son jeton fait foi), le porteur peut
--    relire sa demande, la corriger tant qu'elle n'est pas au vote, et joindre
--    des documents.
-- 2. Ses messages, documents et corrections préviennent ceux qui suivent la
--    demande (ou toute l'équipe si personne ne la suit encore), avec son nom
--    et le projet dans la notification.
--
-- Les documents vont dans un espace de stockage PRIVÉ : un plan d'affaires
-- n'a rien à faire derrière une adresse publique. Chaque fichier est rangé
-- sous le jeton de suivi de sa demande : seul ce jeton permet d'en déposer,
-- seule l'équipe peut les lire.
--
-- Appliquée en plusieurs fois (024a à 024g) via le connecteur. Un document
-- « retiré » par le porteur est masqué (retire_le), pas effacé : le fichier
-- reste dans l'espace privé, invisible des deux côtés.

-- ── Statuts ─────────────────────────────────────────────────────────────────

-- Corriger sa demande : jusqu'à la mise au vote. Ensuite, les partenaires
-- évaluent un texte qui ne doit plus bouger ; il reste les messages.
create or replace function public.demande_modifiable(s public.demande_statut)
returns boolean
language sql
immutable
as $$
  select s in ('nouvelle', 'en_accueil', 'en_qualification', 'en_attente_comite');
$$;

-- Joindre un document : tant que la demande est en cours de traitement.
create or replace function public.demande_ouverte_aux_documents(s public.demande_statut)
returns boolean
language sql
immutable
as $$
  select s in ('nouvelle', 'en_accueil', 'en_qualification', 'en_attente_comite', 'en_instruction', 'orientee');
$$;

-- ── Jeton → demande ────────────────────────────────────────────────────────
-- Utilisé par les règles du stockage, qui ne voient qu'un nom de dossier
-- (du texte) : un texte qui n'est pas un uuid ne lève pas d'erreur, il est
-- simplement refusé.
create or replace function public.jeton_suivi_valide(p_jeton text, p_pour_deposer boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.demande_statut;
begin
  if p_jeton is null or p_jeton !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  select statut into s from public.demandes_accueil where token_suivi = p_jeton::uuid;
  if s is null then
    return false;
  end if;
  return not p_pour_deposer or public.demande_ouverte_aux_documents(s);
end;
$$;

grant execute on function public.jeton_suivi_valide(text, boolean) to anon, authenticated;

-- ── Prévenir l'équipe ──────────────────────────────────────────────────────
-- Préviennent : l'interlocuteur de la demande, et tous les membres de l'équipe
-- qui y ont déjà pris part (réponse au porteur, discussion interne). Si
-- personne ne la suit encore, toute l'équipe : une demande sans suivi ne doit
-- pas parler dans le vide.
create or replace function public.prevenir_equipe_demande(p_demande uuid, p_type text, p_titre text, p_ancre text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qui uuid[];
begin
  select array_agg(distinct u) into v_qui
  from (
    select coach_id as u from public.demandes_accueil where id = p_demande and coach_id is not null
    union
    select auteur_id from public.messages_demande where demande_id = p_demande and auteur = 'equipe' and auteur_id is not null
    union
    select auteur_id from public.notes_demande where demande_id = p_demande and auteur_id is not null
  ) s;

  insert into public.notifications (user_id, type, titre, lien)
  select pr.id, p_type, left(p_titre, 240), '/demandes/' || p_demande::text || coalesce(p_ancre, '')
  from public.profiles pr
  where pr.role in ('admin', 'partenaire')
    and (v_qui is null or pr.id = any (v_qui));
end;
$$;

revoke execute on function public.prevenir_equipe_demande(uuid, text, text, text) from public, anon, authenticated;

-- ── Messages du porteur : notification nominative ─────────────────────────
-- Remplace la version de la migration 013, qui prévenait toute l'équipe avec
-- un titre anonyme (« Message d'un porteur sur sa demande ») : impossible de
-- savoir qui écrivait, ni à propos de quoi.
create or replace function public.poster_message_porteur(p_token uuid, p_contenu text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes_accueil%rowtype;
  v_texte text := btrim(coalesce(p_contenu, ''));
begin
  if length(v_texte) < 2 then
    raise exception 'Message vide.';
  end if;
  if length(v_texte) > 5000 then
    raise exception 'Message trop long.';
  end if;

  select * into d from public.demandes_accueil where token_suivi = p_token;
  if d.id is null then
    raise exception 'Lien de suivi invalide.';
  end if;

  insert into public.messages_demande (demande_id, auteur, contenu)
  values (d.id, 'porteur', v_texte);

  perform public.prevenir_equipe_demande(
    d.id,
    'message_demande',
    d.prenom || ' ' || d.nom || ' vous a écrit : « '
      || case when length(v_texte) > 90 then left(v_texte, 90) || '…' else v_texte end || ' »',
    '#echange'
  );

  return true;
end;
$$;

grant execute on function public.poster_message_porteur(uuid, text) to anon, authenticated;

-- ── Relire et corriger sa demande ──────────────────────────────────────────
create or replace function public.get_demande_porteur(p_token uuid)
returns table (
  titre_projet text,
  description text,
  organisation text,
  telephone text,
  modifiable boolean,
  documents_permis boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select d.titre_projet, d.description, d.organisation, d.telephone,
         public.demande_modifiable(d.statut),
         public.demande_ouverte_aux_documents(d.statut)
  from public.demandes_accueil d
  where d.token_suivi = p_token;
$$;

grant execute on function public.get_demande_porteur(uuid) to anon, authenticated;

create or replace function public.modifier_demande_porteur(
  p_token uuid,
  p_titre text,
  p_description text,
  p_organisation text,
  p_telephone text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes_accueil%rowtype;
  v_titre text := btrim(coalesce(p_titre, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_organisation text := nullif(btrim(coalesce(p_organisation, '')), '');
  v_telephone text := nullif(btrim(coalesce(p_telephone, '')), '');
  v_changes text[] := '{}';
begin
  select * into d from public.demandes_accueil where token_suivi = p_token;
  if d.id is null then
    raise exception 'Lien de suivi invalide.';
  end if;
  if not public.demande_modifiable(d.statut) then
    raise exception 'Votre demande est à l''étude : écrivez plutôt un message à l''équipe.';
  end if;
  if length(v_titre) < 3 or length(v_titre) > 200 then
    raise exception 'Le nom du projet doit faire entre 3 et 200 caractères.';
  end if;
  if length(v_description) < 40 or length(v_description) > 8000 then
    raise exception 'La description doit faire entre 40 et 8 000 caractères.';
  end if;
  if length(coalesce(v_organisation, '')) > 200 or length(coalesce(v_telephone, '')) > 40 then
    raise exception 'Structure ou téléphone trop long.';
  end if;

  if v_titre is distinct from d.titre_projet then v_changes := array_append(v_changes, 'nom du projet'); end if;
  if v_description is distinct from d.description then v_changes := array_append(v_changes, 'description'); end if;
  if v_organisation is distinct from d.organisation then v_changes := array_append(v_changes, 'structure'); end if;
  if v_telephone is distinct from d.telephone then v_changes := array_append(v_changes, 'téléphone'); end if;

  if cardinality(v_changes) = 0 then
    return false;
  end if;

  update public.demandes_accueil
     set titre_projet = v_titre,
         description = v_description,
         organisation = v_organisation,
         telephone = v_telephone
   where id = d.id;

  -- Une trace dans le fil, visible des deux côtés : l'équipe sait ce qui a
  -- bougé, le porteur sait que c'est arrivé.
  insert into public.messages_demande (demande_id, auteur, contenu)
  values (d.id, 'porteur', 'J''ai mis à jour ma demande (' || array_to_string(v_changes, ', ') || ').');

  perform public.prevenir_equipe_demande(
    d.id,
    'message_demande',
    d.prenom || ' ' || d.nom || ' a mis à jour sa demande « ' || v_titre || ' » (' || array_to_string(v_changes, ', ') || ')',
    ''
  );

  return true;
end;
$$;

grant execute on function public.modifier_demande_porteur(uuid, text, text, text, text) to anon, authenticated;

-- ── Documents joints ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'demandes-documents',
  'demandes-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'
  ]
)
on conflict (id) do nothing;

create policy demandes_documents_depot on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'demandes-documents'
    and public.jeton_suivi_valide((storage.foldername(name))[1], true)
  );

-- Lecture : l'équipe seulement. Une lecture « par jeton valide » laisserait
-- un anonyme lister le stockage, donc découvrir les jetons des autres. Le
-- porteur voit la liste de ses documents (get_documents_suivi) et garde ses
-- originaux.
create policy demandes_documents_lecture on storage.objects
  for select to authenticated
  using (
    bucket_id = 'demandes-documents'
    and public.get_my_role() = any (array['admin'::public.user_role, 'partenaire'::public.user_role])
  );

create table if not exists public.documents_demande (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_accueil(id) on delete cascade,
  chemin text not null unique,
  nom text not null check (length(nom) between 1 and 200),
  taille integer not null check (taille > 0),
  type text,
  created_at timestamptz not null default now(),
  -- Retiré par le porteur : masqué partout, gardé pour la trace.
  retire_le timestamptz
);

create index if not exists documents_demande_idx on public.documents_demande (demande_id, created_at);

alter table public.documents_demande enable row level security;

-- Lecture par l'équipe seulement ; le porteur passe par les fonctions
-- ci-dessous, et personne n'écrit directement dans la table.
create policy documents_demande_select on public.documents_demande
  for select to authenticated
  using (get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]));

create or replace function public.get_documents_suivi(p_token uuid)
returns table (id uuid, nom text, taille integer, chemin text, ajoute_le timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select doc.id, doc.nom, doc.taille, doc.chemin, doc.created_at
  from public.documents_demande doc
  join public.demandes_accueil d on d.id = doc.demande_id
  where d.token_suivi = p_token and doc.retire_le is null
  order by doc.created_at;
$$;

grant execute on function public.get_documents_suivi(uuid) to anon, authenticated;

create or replace function public.ajouter_document_porteur(
  p_token uuid,
  p_chemin text,
  p_nom text,
  p_taille integer,
  p_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes_accueil%rowtype;
  v_nom text := left(btrim(coalesce(p_nom, '')), 200);
  v_id uuid;
begin
  select * into d from public.demandes_accueil where token_suivi = p_token;
  if d.id is null then
    raise exception 'Lien de suivi invalide.';
  end if;
  if not public.demande_ouverte_aux_documents(d.statut) then
    raise exception 'Cette demande n''accepte plus de documents.';
  end if;
  if p_chemin is null or split_part(p_chemin, '/', 1) <> p_token::text then
    raise exception 'Document invalide.';
  end if;
  -- Le fichier doit réellement être arrivé dans le stockage.
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'demandes-documents' and o.name = p_chemin
  ) then
    raise exception 'Document introuvable : renvoyez-le.';
  end if;
  if (select count(*) from public.documents_demande where demande_id = d.id and retire_le is null) >= 15 then
    raise exception 'Quinze documents au plus : retirez-en un avant d''en ajouter.';
  end if;
  if v_nom = '' then
    v_nom := 'Document';
  end if;

  insert into public.documents_demande (demande_id, chemin, nom, taille, type)
  values (d.id, p_chemin, v_nom, greatest(coalesce(p_taille, 1), 1), p_type)
  returning id into v_id;

  insert into public.messages_demande (demande_id, auteur, contenu)
  values (d.id, 'porteur', 'Document ajouté : ' || v_nom);

  perform public.prevenir_equipe_demande(
    d.id,
    'message_demande',
    d.prenom || ' ' || d.nom || ' a ajouté un document à « ' || d.titre_projet || ' » : ' || v_nom,
    '#documents'
  );

  return v_id;
end;
$$;

grant execute on function public.ajouter_document_porteur(uuid, text, text, integer, text) to anon, authenticated;

-- Retire un document : masqué des deux côtés, gardé pour la trace.
create or replace function public.retirer_document_porteur(p_token uuid, p_document uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes_accueil%rowtype;
  v_nom text;
begin
  select * into d from public.demandes_accueil where token_suivi = p_token;
  if d.id is null then
    raise exception 'Lien de suivi invalide.';
  end if;
  if not public.demande_ouverte_aux_documents(d.statut) then
    raise exception 'Cette demande est close : ses documents restent au dossier.';
  end if;

  update public.documents_demande
     set retire_le = now()
   where id = p_document and demande_id = d.id and retire_le is null
  returning nom into v_nom;

  if v_nom is null then
    raise exception 'Document introuvable.';
  end if;

  insert into public.messages_demande (demande_id, auteur, contenu)
  values (d.id, 'porteur', 'Document retiré : ' || v_nom);

  return true;
end;
$$;

grant execute on function public.retirer_document_porteur(uuid, uuid) to anon, authenticated;
