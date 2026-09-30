-- 022 — La décision d'entrée en promotion est réservée à l'administrateur.
--
-- La politique de mise à jour des demandes laisse tout partenaire modifier
-- une demande (il faut bien pouvoir la qualifier). Sans cette garde, un
-- partenaire pourrait, depuis sa session, passer une demande en « admise » —
-- ce qui ouvre le projet — ou sortir une demande du vote. Les actions de
-- l'application le vérifient déjà ; la base le garantit.

create or replace function public.proteger_decision_demande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Les opérations de service (sans utilisateur connecté) ne sont pas visées.
  if auth.uid() is null or new.statut is not distinct from old.statut then
    return new;
  end if;

  if public.get_my_role() is distinct from 'admin' then
    if new.statut = 'admise' then
      raise exception 'Seul un administrateur peut admettre une demande.';
    end if;
    if old.statut = 'en_instruction' then
      raise exception 'Une demande au vote ne change d''étape que par décision d''un administrateur.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.proteger_decision_demande() from public, anon, authenticated;

drop trigger if exists demandes_decision_admin on public.demandes_accueil;
create trigger demandes_decision_admin
  before update of statut on public.demandes_accueil
  for each row execute function public.proteger_decision_demande();
