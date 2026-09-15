# Base de données ArcInnoLab

Le schéma complet vit dans `migrations/`. Ces fichiers sont la **source de
vérité** : ils ont été extraits de la base de production et vérifiés bit à bit
(empreintes md5 dans `CHECKSUMS.md5`). Rejouer les 10 fichiers dans l'ordre
reconstitue une base identique, à partir d'un projet Supabase vierge.

## Recréer la base sur un nouveau projet Supabase

1. Créer un projet vide (région `eu-central-1`, cohérente avec l'hébergement
   des données en Europe).
2. Appliquer les migrations **dans l'ordre des noms de fichiers** — l'ordre
   compte, chacune s'appuie sur la précédente.
3. Vérifier que le bucket de stockage `arcinnolab-media` existe et est public
   (créé par la migration `006`).
4. Reporter dans les variables d'environnement de l'application :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Ré-uploader les visuels de marque dans le bucket (`public/brand/` est servi
   par l'application elle-même, mais les logos de projet et avatars uploadés
   par les utilisateurs vivent dans le bucket et ne sont pas migrés
   automatiquement).
6. Recréer le premier compte administrateur via la page `/bootstrap`, qui se
   désactive d'elle-même dès qu'un admin existe.

Les comptes utilisateurs (`auth.users`) ne sont **pas** dans les migrations :
un nouveau projet repart d'une base d'utilisateurs vide, ce qui est le
comportement voulu pour un changement d'environnement.

## Vérifier l'intégrité des migrations

```bash
cd supabase/migrations && md5sum -c ../CHECKSUMS.md5
```

Les empreintes correspondent au contenu tel qu'appliqué en base le 09/09/2026.
Si vous modifiez une migration déjà appliquée, l'empreinte ne correspondra
plus — c'est normal et attendu : ajoutez plutôt une nouvelle migration.

## Le plan gratuit met le projet en pause

Sur le plan Free, Supabase suspend un projet après **7 jours sans activité**.
Ce n'est pas un risque, c'est un comportement documenté et déterministe. Comme
l'usage d'ArcInnoLab est irrégulier par nature, deux garde-fous sont en place :

1. **`.github/workflows/keep-alive.yml`** — interroge la base deux fois par
   semaine. Nécessite les secrets `SUPABASE_URL` et `SUPABASE_ANON_KEY`.
2. **Une tâche de surveillance mensuelle** — vérifie que le workflow tourne
   toujours et que le projet est bien actif. Elle existe parce que GitHub
   désactive les workflows planifiés d'un dépôt resté inactif 60 jours : sans
   ce second garde-fou, le premier s'éteindrait en silence.

Si le projet est malgré tout mis en pause, il se réactive depuis le tableau de
bord Supabase sans perte de données. Le plan Free ne propose en revanche
**aucune sauvegarde** : c'est la limite acceptée pour cette phase de
démonstration, à revoir avant toute mise en service réelle avec des données de
porteurs de projets.

## Une migration « test » dans l'historique de la base

L'historique Supabase contient une entrée `test_temporaire_ouverture_projet`
(15/09/2026) qui n'a **pas** de fichier ici, et c'est volontaire. C'était un
bloc `DO` de vérification du déclencheur de la migration 016 : il crée une
demande fictive, l'admet, contrôle qu'un projet et une seule invitation sont
bien nés, vérifie qu'une seconde admission ne produit pas de doublon, puis
efface tout ce qu'il a créé. Il ne modifie aucune structure et n'a laissé
aucune donnée. Il n'est pas versionné parce qu'il ne pourrait pas être rejoué
tel quel sur une base vierge : il suppose qu'au moins un compte d'équipe
existe.
