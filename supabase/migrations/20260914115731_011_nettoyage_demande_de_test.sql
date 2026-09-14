-- Retire la demande insérée le 14/09/2026 pour vérifier, depuis un navigateur
-- et avec la clé publique, que la porte d'entrée anonyme accepte bien un dépôt
-- sans permettre la moindre lecture. Test concluant : 201 à l'écriture, zéro
-- ligne lisible sur les sept tables interrogées.
delete from public.demandes_accueil where email = 'test-anon@example.org';
