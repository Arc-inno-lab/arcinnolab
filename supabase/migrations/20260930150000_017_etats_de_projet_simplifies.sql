-- Les états hérités de la V0 (brouillon, soumis, validé) n'ont plus de sens
-- depuis qu'un projet naît de l'admission d'une candidature : il est déjà
-- « en cours » à sa création. Il manquait en revanche de quoi dire qu'un
-- projet est suspendu, ou qu'il est arrivé au bout de son accompagnement.
--
-- Ajout isolé dans sa propre migration : Postgres interdit d'utiliser une
-- valeur d'énumération dans la transaction même qui l'a créée.
alter type public.projet_etat add value if not exists 'en_pause';
alter type public.projet_etat add value if not exists 'termine';
