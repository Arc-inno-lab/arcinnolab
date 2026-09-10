-- La brique "fiche projet" ajoute la création réelle de projets : on resserre la policy
-- d'insertion pour qu'un Partenaire ne puisse se déclarer référent que de lui-même.
-- L'Admin garde la liberté de désigner n'importe quel référent (réassignation).
drop policy if exists projets_insert on public.projets;
create policy projets_insert on public.projets
  for insert
  with check (
    get_my_role() = 'admin'::user_role
    or (get_my_role() = 'partenaire'::user_role and id_partenaire_createur = auth.uid())
  );
