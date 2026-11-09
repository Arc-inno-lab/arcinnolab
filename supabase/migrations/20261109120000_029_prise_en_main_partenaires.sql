-- 029 · Avant d'inviter les partenaires : trois corrections relevées en
-- préparant le guide de prise en main.
--
-- 1. Seul l'administrateur clôt un vote. Le bouton ne s'affichait qu'à lui,
--    mais la base laissait n'importe quel partenaire modifier un tour de vote.
--    Les autres écritures passent par des fonctions SECURITY DEFINER
--    (maj_completude_tour), que la policy ne concerne pas.
-- 2. La page d'invitation reprend le prénom, le nom et la structure déjà
--    connus, au lieu de les redemander.
-- 3. Les e-mails « message de projet », « message sur une étape »,
--    « rendez-vous » et « étape » partaient avec un titre et un bouton seuls :
--    ils ont maintenant une phrase d'explication.

-- ── 1. Clôture du vote ──────────────────────────────────────────────────────
alter policy tours_update on public.tours_vote
  using (get_my_role() = 'admin'::user_role)
  with check (get_my_role() = 'admin'::user_role);

-- ── 2. Identité connue à l'invitation ───────────────────────────────────────
-- Même principe que get_invitation_preview : le jeton suffit, et seule une
-- invitation encore valable renvoie quelque chose.
create or replace function public.get_invitation_identite(p_token uuid)
returns table (prenom text, nom text, organisation text)
language sql
stable
security definer
set search_path = public
as $$
  select i.prenom, i.nom, i.organisation
    from public.invitations i
   where i.token = p_token
     and i.statut = 'en_attente'
     and i.date_expiration > now();
$$;
grant execute on function public.get_invitation_identite(uuid) to anon, authenticated;

-- ── 3. Des e-mails qui disent de quoi il s'agit ─────────────────────────────
create or replace function public.courriel_pour_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  v_corps text;
  v_pied text;
begin
  if new.type not in ('demande_accueil', 'message_demande', 'mention', 'tour_vote', 'message_direct',
                      'message_projet', 'message_etape', 'rendez_vous', 'etape_a_valider', 'etape_statut',
                      'demande_acces') then
    return new;
  end if;

  select * into p from public.profiles where id = new.user_id;
  if p.id is null or not p.courriels_actifs or not public.adresse_envoyable(p.email) then
    return new;
  end if;

  if exists (
    select 1 from public.courriels
     where user_id = p.id
       and cle_regroupement = coalesce(new.lien, new.type)
       and created_at > now() - interval '15 minutes'
  ) then
    new.envoye_par_courriel := true;
    return new;
  end if;

  v_corps := case new.type
    when 'demande_accueil' then 'Une nouvelle demande vient d''arriver sur la page de dépôt. Une demande sans réponse est le seul vrai échec du guichet : qui la prend en charge ?'
    when 'message_demande' then 'Répondez depuis la fiche de la demande : le porteur lit votre réponse sur sa page de suivi, et il en est prévenu par e-mail.'
    when 'mention' then 'On vous a mentionné dans la discussion de l''équipe sur une demande.'
    when 'tour_vote' then 'Votre avis est attendu sur cette candidature : favorable, défavorable ou abstention, avec un mot pour expliquer.'
    when 'message_direct' then 'Vous avez reçu un message dans ArcInnoLab.'
    when 'message_projet' then 'Un nouveau message a été publié sur le projet. Vous pouvez le lire et y répondre directement dans ArcInnoLab.'
    when 'message_etape' then 'Un nouveau message a été laissé sur une étape du parcours. Ouvrez l''étape pour le lire et y répondre.'
    when 'rendez_vous' then 'Un rendez-vous a été proposé, confirmé ou modifié. Ouvrez-le pour le confirmer, l''ajouter à votre agenda ou proposer une autre date.'
    when 'etape_a_valider' then 'Une étape du parcours attend votre validation.'
    when 'etape_statut' then 'Une étape du parcours a avancé. Ouvrez le projet pour voir où vous en êtes.'
    when 'demande_acces' then 'Quelqu''un demande un accès à la plateforme. Rien n''est créé tant que vous n''avez pas choisi son rôle et validé, dans l''Administration.'
    else ''
  end;

  v_pied := case when p.role = 'porteur'
    then 'Vous recevez cet e-mail parce que vous êtes accompagné par ArcInnoLab. Vous pouvez couper ces e-mails dans « Mon compte ».'
    else 'Vous recevez cet e-mail parce que vous êtes membre de l''équipe ArcInnoLab. Vous pouvez couper ces e-mails dans votre profil.'
  end;

  insert into public.courriels (destinataire, user_id, categorie, cle_regroupement, sujet, titre, corps, bouton_libelle, bouton_lien, pied)
  values (
    p.email, p.id, 'notification', coalesce(new.lien, new.type),
    left(new.titre, 150),
    new.titre,
    v_corps,
    'Ouvrir dans ArcInnoLab',
    public.parametre('app_url') || coalesce(new.lien, '/'),
    v_pied
  );

  new.envoye_par_courriel := true;
  return new;
end;
$$;
