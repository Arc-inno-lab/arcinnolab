-- 027 · Préparation du salon : vitrine des projets, continuité du porteur
-- admis, invitations envoyées par e-mail.
--
-- 1. Vitrine des projets : un projet n'apparaît sur la page publique que si
--    l'équipe (référent ou administrateur) le décide et rédige un résumé
--    public. La lecture publique passe par une fonction qui ne renvoie que ces
--    champs-là — jamais la description interne ni les membres.
-- 2. Porteur admis : jusqu'ici, il recevait une invitation valable 7 jours, que
--    personne ne lui envoyait. Désormais l'invitation part par e-mail, vaut
--    30 jours, et sa page de suivi lui en refait une s'il l'a laissée expirer.
--    Une fois dans son espace, il retrouve l'historique de sa demande
--    (messages et documents).
-- 3. Toute invitation (partenaire ou porteur) part par e-mail, avec son lien.

-- ── 1. Vitrine des projets ──────────────────────────────────────────────────
alter table public.projets add column if not exists vitrine_visible boolean not null default false;
alter table public.projets add column if not exists vitrine_resume text
  check (vitrine_resume is null or length(vitrine_resume) <= 400);
alter table public.projets add column if not exists vitrine_lien text
  check (vitrine_lien is null or (vitrine_lien ~* '^https?://' and length(vitrine_lien) <= 300));

-- Le porteur peut modifier sa description, pas décider de s'afficher en public :
-- la vitrine rejoint les champs réservés au référent et à l'administrateur.
create or replace function public.proteger_champs_projet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() = 'admin' or public.is_project_referent(new.id) then
    return new;
  end if;

  if new.titre is distinct from old.titre
     or new.etat is distinct from old.etat
     or new.id_partenaire_createur is distinct from old.id_partenaire_createur
     or new.vitrine_visible is distinct from old.vitrine_visible
     or new.vitrine_resume is distinct from old.vitrine_resume
     or new.vitrine_lien is distinct from old.vitrine_lien then
    raise exception 'Seul le partenaire référent peut modifier ces éléments du projet.';
  end if;

  return new;
end;
$$;

create or replace function public.projets_vitrine()
returns table (id uuid, titre text, resume text, logo_url text, lien text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.titre, p.vitrine_resume, p.logo_url, p.vitrine_lien
  from public.projets p
  where p.vitrine_visible
    and coalesce(btrim(p.vitrine_resume), '') <> ''
    and p.etat not in ('archive')
  order by p.date_creation desc
  limit 12;
$$;
grant execute on function public.projets_vitrine() to anon, authenticated;

-- ── 2. Le porteur admis garde le lien avec l'équipe ─────────────────────────
-- L'invitation créée à l'admission vaut désormais 30 jours.
create or replace function public.ouvrir_projet_a_admission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referent uuid;
  nouveau_projet uuid;
  compte_existant uuid;
begin
  if new.statut <> 'admise' or old.statut = 'admise' then
    return new;
  end if;
  if new.projet_id is not null then
    return new;
  end if;

  referent := coalesce(new.coach_id, auth.uid());
  if referent is null then
    return new;
  end if;

  insert into public.projets (titre, description, etat, id_partenaire_createur)
  values (new.titre_projet, new.description, 'en_cours', referent)
  returning id into nouveau_projet;

  new.projet_id := nouveau_projet;

  select id into compte_existant from public.profiles where lower(email) = lower(new.email);

  if compte_existant is null then
    insert into public.invitations (email, role_cible, id_emetteur, projet_id, nom, prenom, organisation, date_expiration)
    values (new.email, 'porteur', referent, nouveau_projet, new.nom, new.prenom, new.organisation, now() + interval '30 days');
  else
    insert into public.membres_projet (projet_id, user_id)
    values (nouveau_projet, compte_existant)
    on conflict do nothing;
  end if;

  insert into public.notifications (user_id, type, titre, lien)
  values (referent, 'projet', 'Projet ouvert : ' || new.titre_projet, '/projets/' || nouveau_projet::text);

  return new;
end;
$$;

-- Depuis sa page de suivi, le porteur admis obtient toujours un lien valable
-- pour créer son accès : celui qui l'attend, ou un nouveau s'il a expiré.
-- Renvoie null s'il a déjà un compte (il n'a plus qu'à se connecter).
create or replace function public.lien_acces_porteur(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandes_accueil%rowtype;
  v_referent uuid;
  v_jeton uuid;
begin
  select * into d from public.demandes_accueil where token_suivi = p_token;
  if d.id is null or d.statut <> 'admise' or d.projet_id is null then
    return null;
  end if;

  if exists (select 1 from public.profiles where lower(email) = lower(d.email)) then
    -- Un compte existe : on s'assure qu'il est bien rattaché au projet.
    insert into public.membres_projet (projet_id, user_id)
    select d.projet_id, pr.id from public.profiles pr where lower(pr.email) = lower(d.email)
    on conflict do nothing;
    return null;
  end if;

  select token into v_jeton
    from public.invitations
   where projet_id = d.projet_id and lower(email) = lower(d.email)
     and statut = 'en_attente' and date_expiration > now()
   order by date_envoi desc
   limit 1;
  if v_jeton is not null then
    return v_jeton;
  end if;

  select id_partenaire_createur into v_referent from public.projets where id = d.projet_id;
  insert into public.invitations (email, role_cible, id_emetteur, projet_id, nom, prenom, organisation, date_expiration)
  values (d.email, 'porteur', coalesce(d.coach_id, v_referent), d.projet_id, d.nom, d.prenom, d.organisation, now() + interval '30 days')
  returning token into v_jeton;
  return v_jeton;
end;
$$;
grant execute on function public.lien_acces_porteur(uuid) to anon, authenticated;

-- L'historique de la demande, lisible dans l'espace projet par ses membres et
-- son équipe : les échanges d'avant l'admission ne disparaissent plus.
create or replace function public.historique_demande_projet(p_projet uuid)
returns table (genre text, auteur text, contenu text, chemin text, taille integer, quand timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with d as (
    select da.* from public.demandes_accueil da
     where da.projet_id = p_projet
       and (public.is_project_member(p_projet) or public.is_project_referent(p_projet)
            or public.get_my_role() = any (array['admin'::user_role, 'partenaire'::user_role]))
     limit 1
  )
  select 'demande', d.prenom || ' ' || d.nom, d.description, null::text, null::integer, d.created_at from d
  union all
  select 'message',
         case when m.auteur = 'porteur' then d.prenom else coalesce(pr.prenom, 'L''équipe') end,
         m.contenu, null, null, m.created_at
    from d join public.messages_demande m on m.demande_id = d.id
    left join public.profiles pr on pr.id = m.auteur_id
  union all
  select 'document', d.prenom, doc.nom, doc.chemin, doc.taille, doc.created_at
    from d join public.documents_demande doc on doc.demande_id = d.id and doc.retire_le is null
  order by 6;
$$;
grant execute on function public.historique_demande_projet(uuid) to authenticated;

-- Les documents joints à la demande restent lisibles par le porteur une fois
-- dans son espace projet (et par l'équipe, comme avant).
-- La vérification passe par une fonction : le porteur ne lit ni la table des
-- documents de la demande ni la demande elle-même, une policy qui les
-- interrogerait directement ne trouverait donc jamais rien.
create or replace function public.document_demande_du_projet(p_chemin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documents_demande doc
      join public.demandes_accueil d on d.id = doc.demande_id
     where doc.chemin = p_chemin
       and doc.retire_le is null
       and d.projet_id is not null
       and public.is_project_member(d.projet_id)
  );
$$;
revoke execute on function public.document_demande_du_projet(text) from public, anon;
grant execute on function public.document_demande_du_projet(text) to authenticated;

create policy demandes_documents_lecture_membres on storage.objects
  for select to authenticated
  using (bucket_id = 'demandes-documents' and public.document_demande_du_projet(name));

-- ── 3. Chaque invitation part par e-mail ────────────────────────────────────
create or replace function public.courriel_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titre_projet text;
  v_qui text;
begin
  if new.statut <> 'en_attente' or not public.adresse_envoyable(new.email) then
    return new;
  end if;
  select titre into v_titre_projet from public.projets where id = new.projet_id;
  select prenom || ' ' || nom into v_qui from public.profiles where id = new.id_emetteur;

  insert into public.courriels (destinataire, categorie, cle_regroupement, sujet, titre, corps, bouton_libelle, bouton_lien, pied)
  values (
    new.email, 'porteur', 'invitation-' || new.id::text,
    case when new.role_cible = 'porteur' then 'Votre espace projet ArcInnoLab vous attend' else 'Votre accès partenaire à ArcInnoLab' end,
    case when new.prenom is not null then 'Bonjour ' || new.prenom else 'Bonjour' end,
    case when new.role_cible = 'porteur'
      then 'Votre espace projet' || coalesce(' « ' || v_titre_projet || ' »', '') || ' est ouvert. Vous y suivrez votre parcours avec votre accompagnateur, vos rendez-vous, vos documents et vos échanges avec l''équipe.'
           || E'\n\n' || 'Il ne vous reste qu''à créer votre accès : choisissez un mot de passe, et c''est prêt.'
      else coalesce(v_qui, 'L''équipe ArcInnoLab') || ' vous ouvre un accès partenaire à la plateforme ArcInnoLab : demandes à accueillir, projets accompagnés, agenda du réseau.'
           || E'\n\n' || 'Créez votre accès en choisissant votre mot de passe.'
    end,
    'Créer mon accès',
    public.parametre('app_url') || '/invite/' || new.token::text,
    'Ce lien est personnel et valable jusqu''au ' || to_char(new.date_expiration at time zone 'Europe/Paris', 'DD/MM/YYYY') || '. Si vous n''attendiez pas cet e-mail, ignorez-le.'
  );
  return new;
end;
$$;
revoke execute on function public.courriel_invitation() from public, anon, authenticated;

create trigger invitations_courriel
  after insert on public.invitations
  for each row execute function public.courriel_invitation();
