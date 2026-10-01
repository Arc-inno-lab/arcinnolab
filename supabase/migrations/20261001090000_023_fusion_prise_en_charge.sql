-- 023 · « Prise en charge » et « Qualification » ne font plus qu'une étape.
--
-- Prendre en charge une demande la fait passer directement en qualification.
-- Le statut « en_accueil » reste dans le type (on ne retire pas une valeur
-- d'un enum Postgres), mais plus aucune demande ne le porte.

update public.demandes_accueil
   set statut = 'en_qualification'
 where statut = 'en_accueil';
