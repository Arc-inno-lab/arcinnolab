-- Ouvre la lecture des profils à tout utilisateur authentifié (au lieu de : soi-même, ou admin/
-- partenaire). Nécessaire pour : l'annuaire "contacter un partenaire" sur le tableau de bord
-- (visible par tous les rôles), et pour que les membres d'un même projet voient les noms de
-- leurs coéquipiers (un porteur ne voyait jusqu'ici même pas le nom de son propre référent).
-- Cohérent avec le modèle déjà retenu ailleurs (plateforme fermée, accès nominatif uniquement,
-- cf. RLS permissive de la table notifications) — mais élargit la visibilité des emails à tous
-- les comptes, à signaler à César comme point à trancher (cf. doc de statut).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);
