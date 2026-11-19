-- 030 · Supprimer un compte, depuis l'Administration.
--
-- Pour un partenaire qui quitte sa structure, un porteur qui le demande, un
-- compte créé par erreur. Seul un administrateur supprime, jamais son propre
-- compte ni celui d'un autre administrateur (il repasse d'abord en partenaire :
-- la plateforme ne peut pas se retrouver sans administrateur).
--
-- Ce que devient ce que la personne laisse derrière elle :
--   · ses projets dont elle est référente passent à l'administrateur qui
--     supprime (un projet n'est jamais sans accompagnateur) ;
--   · les invitations qu'elle a émises passent aussi à cet administrateur ;
--   · ses messages dans les projets restent, signés « Ancien membre » (l'auteur
--     devient vide) : l'historique du projet ne se troue pas ;
--   · ses documents restent, sans auteur ; ses validations d'étape aussi ;
--   · ses messages directs et ses anciens rendez-vous (V0) sont effacés, comme
--     tout ce qui lui était propre (notifications, rattachements, avis de vote).

alter table public.messages_projet alter column auteur_id drop not null;
-- La contrainte d'origine (sans action à la suppression) est retrouvée par sa
-- colonne plutôt que par son nom, généré automatiquement.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.messages_projet'::regclass and contype = 'f'
       and conkey = array[(select attnum from pg_attribute
                            where attrelid = 'public.messages_projet'::regclass and attname = 'auteur_id')]::smallint[]
  loop
    execute format('alter table public.messages_projet drop constraint %I', c);
  end loop;
end $$;
alter table public.messages_projet
  add constraint messages_projet_auteur_id_fkey
  foreign key (auteur_id) references public.profiles(id) on delete set null;

create or replace function public.supprimer_compte(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin uuid := auth.uid();
  v_cible public.profiles%rowtype;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Seul un administrateur supprime un compte.';
  end if;
  if p_user is null or p_user = v_admin then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte.';
  end if;

  select * into v_cible from public.profiles where id = p_user;
  if v_cible.id is null then
    raise exception 'Ce compte n''existe plus.';
  end if;
  if v_cible.role = 'admin' then
    raise exception 'Un administrateur ne se supprime pas directement : passez d''abord son rôle à Partenaire.';
  end if;

  update public.projets set id_partenaire_createur = v_admin where id_partenaire_createur = p_user;
  update public.invitations set id_emetteur = v_admin where id_emetteur = p_user;
  update public.documents set uploaded_by = null where uploaded_by = p_user;
  update public.etapes_projet set id_partenaire_validateur = null where id_partenaire_validateur = p_user;
  delete from public.rendez_vous where user_id = p_user or partenaire_id = p_user;
  delete from public.messages where expediteur_id = p_user or destinataire_id = p_user;

  -- Le compte lui-même : le profil et tout ce qui en dépend partent en cascade.
  delete from auth.users where id = p_user;

  return v_cible.prenom || ' ' || v_cible.nom;
end;
$$;
revoke execute on function public.supprimer_compte(uuid) from public, anon;
grant execute on function public.supprimer_compte(uuid) to authenticated;
