-- Ce que le test de César a mis au jour : entre « candidature admise » et
-- « projet accompagné », il y avait un trou que quelqu'un devait combler à la
-- main ; et une fois le projet ouvert, le porteur n'y était qu'un spectateur,
-- pendant que l'annuaire lui donnait accès à tout le consortium.
--
--  1. L'admission d'une demande ouvre désormais le projet toute seule.
--  2. Le porteur a la main sur son projet — sauf sur la validation des
--     étapes, qui reste un avis d'accompagnateur.
--  3. Il ne voit et ne peut contacter que les personnes rattachées à ses
--     projets, et non l'ensemble du consortium.

-- ── 1. De la candidature admise au projet ouvert ────────────────────────────
-- La colonne « projet_id » de la demande existait depuis la migration 010 mais
-- personne ne la remplissait : il fallait rouvrir un projet à la main, en
-- recopiant le titre et le descriptif. Le lien qu'elle porte est ce qui
-- garantit qu'une demande n'ouvre jamais deux fois le même projet.
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
  -- Seul le passage à « admise » déclenche l'ouverture, et une seule fois.
  if new.statut <> 'admise' or old.statut = 'admise' then
    return new;
  end if;
  if new.projet_id is not null then
    return new;
  end if;

  -- Le référent est celui qui a suivi la demande. À défaut, celui qui
  -- prononce l'admission : un projet sans référent n'a personne à qui parler.
  referent := coalesce(new.coach_id, auth.uid());
  if referent is null then
    return new;
  end if;

  insert into public.projets (titre, description, etat, id_partenaire_createur)
  values (new.titre_projet, new.description, 'en_cours', referent)
  returning id into nouveau_projet;

  new.projet_id := nouveau_projet;

  -- Le porteur n'a en général pas de compte : le dépôt n'en ouvre aucun.
  -- L'invitation rattachée au projet le fera entrer directement dans son
  -- espace, sans que personne ait à refaire le rapprochement à la main. S'il
  -- en a déjà un, l'inviter échouerait à la création du compte : on le
  -- rattache directement.
  select id into compte_existant from public.profiles where email = new.email;

  if compte_existant is null then
    insert into public.invitations (email, role_cible, id_emetteur, projet_id)
    values (new.email, 'porteur', referent, nouveau_projet);
  else
    insert into public.membres_projet (projet_id, user_id)
    values (nouveau_projet, compte_existant)
    on conflict do nothing;
  end if;

  insert into public.notifications (user_id, type, titre, lien)
  values (
    referent,
    'projet',
    'Projet ouvert : ' || new.titre_projet,
    '/projets/' || nouveau_projet::text
  );

  return new;
end;
$$;

revoke execute on function public.ouvrir_projet_a_admission() from public, anon, authenticated;

drop trigger if exists demandes_ouvrir_projet on public.demandes_accueil;
create trigger demandes_ouvrir_projet
  before update of statut on public.demandes_accueil
  for each row execute function public.ouvrir_projet_a_admission();

-- ── 2. Une étape devient une vraie fiche de travail ─────────────────────────
-- Un titre et une colonne ne suffisent pas à piloter un jalon : il faut
-- pouvoir dire de quoi il s'agit et pour quand.
alter table public.etapes_projet
  add column if not exists description text,
  add column if not exists date_echeance date,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_etape()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists etapes_touch on public.etapes_projet;
create trigger etapes_touch
  before update on public.etapes_projet
  for each row execute function public.touch_etape();

-- Le porteur mène son plan de travail ; le partenaire garde la validation.
-- Un porteur qui valide ses propres jalons vide l'accompagnement de son sens,
-- et ce garde-fou est le seul qui distingue un avis d'un simple statut.
create or replace function public.proteger_validation_etape()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() = 'admin' or public.is_project_referent(new.projet_id) then
    return new;
  end if;

  if new.statut in ('validee', 'refusee') and new.statut is distinct from old.statut then
    raise exception 'Seul le partenaire référent peut valider ou refuser une étape.';
  end if;
  if old.statut in ('validee', 'refusee') and new.statut is distinct from old.statut then
    raise exception 'Cette étape a été tranchée par le partenaire référent : elle ne peut plus être déplacée.';
  end if;
  if new.avis is distinct from old.avis
     or new.id_partenaire_validateur is distinct from old.id_partenaire_validateur
     or new.date_validation is distinct from old.date_validation then
    raise exception 'L''avis du partenaire ne peut être modifié que par lui.';
  end if;

  return new;
end;
$$;

revoke execute on function public.proteger_validation_etape() from public, anon, authenticated;

drop trigger if exists etapes_proteger_validation on public.etapes_projet;
create trigger etapes_proteger_validation
  before update on public.etapes_projet
  for each row execute function public.proteger_validation_etape();

drop policy if exists etapes_projet_write on public.etapes_projet;

create policy etapes_projet_insert on public.etapes_projet for insert to authenticated
  with check (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or public.is_project_member(projet_id)
  );

create policy etapes_projet_update on public.etapes_projet for update to authenticated
  using (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or public.is_project_member(projet_id)
  )
  with check (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or public.is_project_member(projet_id)
  );

-- La suppression reste au référent : effacer un jalon validé effacerait la
-- trace d'un accompagnement.
create policy etapes_projet_delete on public.etapes_projet for delete to authenticated
  using (
    public.get_my_role() = 'admin'
    or public.is_project_referent(projet_id)
    or (public.is_project_member(projet_id) and statut in ('a_faire', 'en_cours'))
  );

-- ── 3. Le porteur présente son projet ───────────────────────────────────────
-- Le descriptif et le logo lui appartiennent. L'état du projet, non : c'est
-- la lecture que l'accompagnateur porte sur son avancement.
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
     or new.id_partenaire_createur is distinct from old.id_partenaire_createur then
    raise exception 'Seul le partenaire référent peut modifier ces éléments du projet.';
  end if;

  return new;
end;
$$;

revoke execute on function public.proteger_champs_projet() from public, anon, authenticated;

drop trigger if exists projets_proteger_champs on public.projets;
create trigger projets_proteger_champs
  before update on public.projets
  for each row execute function public.proteger_champs_projet();

drop policy if exists projets_update on public.projets;
create policy projets_update on public.projets for update to authenticated
  using (
    public.get_my_role() = 'admin'
    or public.is_project_referent(id)
    or public.is_project_member(id)
  );

-- Le référent peut désormais rattacher d'autres partenaires à son projet :
-- c'est ce rattachement qui décide à qui le porteur a accès.
drop policy if exists projet_partenaire_write on public.projet_partenaire;
create policy projet_partenaire_write on public.projet_partenaire for all to authenticated
  using (public.get_my_role() = 'admin' or public.is_project_referent(projet_id))
  with check (public.get_my_role() = 'admin' or public.is_project_referent(projet_id));

-- ── 4. Refermer l'annuaire pour les porteurs ────────────────────────────────
-- L'annuaire était ouvert à tous depuis la migration 007. Un porteur y voyait
-- l'ensemble du consortium et pouvait écrire à n'importe qui. Il ne voit
-- désormais que les personnes rattachées à ses propres projets.
create or replace function public.partage_un_projet(p_autre uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projets p
    where (
        p.id_partenaire_createur = auth.uid()
        or exists (select 1 from public.membres_projet m
                    where m.projet_id = p.id and m.user_id = auth.uid())
        or exists (select 1 from public.projet_partenaire pp
                    where pp.projet_id = p.id and pp.partenaire_id = auth.uid())
      )
      and (
        p.id_partenaire_createur = p_autre
        or exists (select 1 from public.membres_projet m2
                    where m2.projet_id = p.id and m2.user_id = p_autre)
        or exists (select 1 from public.projet_partenaire pp2
                    where pp2.projet_id = p.id and pp2.partenaire_id = p_autre)
      )
  );
$$;

revoke execute on function public.partage_un_projet(uuid) from public, anon;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.get_my_role() in ('admin', 'partenaire')
    or public.partage_un_projet(id)
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    expediteur_id = auth.uid()
    and (
      public.get_my_role() in ('admin', 'partenaire')
      or public.partage_un_projet(destinataire_id)
    )
  );
