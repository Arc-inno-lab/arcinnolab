-- 020 — Nouvelles valeurs d'énumération pour le parcours de qualification.
-- (ALTER TYPE … ADD VALUE doit rester dans une migration à part.)

-- Une demande prise en charge passe en « qualification » : l'appel avec le
-- porteur, puis la décision d'un partenaire (refus, orientation, vote).
alter type public.demande_statut add value if not exists 'en_qualification' after 'en_accueil';

-- Un profil qui n'entre dans aucune des six cases du document « Persona ».
alter type public.persona add value if not exists 'autre';
