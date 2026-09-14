# Déploiement ArcInnoLab

## Où vit quoi

| | Service | Compte |
|---|---|---|
| Code | GitHub | organisation `Arc-inno-lab`, dépôt **public** |
| Base + Auth + Stockage | Supabase | organisation `ArcInnoLab`, projet `poewilykmxwpxqvkrrjq` |
| Hébergement | Vercel | compte `arcinnolab-8306` |

Ces trois comptes sont rattachés à l'adresse dédiée du projet, **pas** à un
compte personnel ni à l'environnement KMØ. C'est délibéré : la plateforme est
financée par un consortium et doit pouvoir lui être remise sans dépendre d'une
personne. La double authentification est active sur le compte propriétaire.

Sur GitHub et Supabase, chaque membre est invité **nominativement** avec son
propre compte — jamais par partage du mot de passe. Vercel, sur son plan
gratuit, ne gère pas d'équipe : ce compte reste donc mono-utilisateur.

## Pourquoi le dépôt est public

Le plan Vercel gratuit **refuse de déployer depuis un dépôt appartenant à une
organisation GitHub privée** — le message est explicite dans l'interface
d'import. Trois issues existaient : payer le plan Pro, passer par GitHub Actions
avec un jeton, ou ouvrir le dépôt. L'ouverture a été retenue : elle est gratuite,
elle ne demande aucun jeton à gérer dans la durée, et elle se défend sur le fond
pour un projet financé par des fonds publics européens.

Ce choix n'expose aucun secret. La seule clé présente dans le code est la clé
`anon` de Supabase, conçue pour être publique : elle part déjà dans le navigateur
de chaque visiteur. Ce qui protège les données, ce sont les politiques RLS, qui
s'appliquent côté Postgres (voir `supabase/migrations/`). Aucune clé
`service_role` n'existe dans ce projet — toute la création de comptes passe par
des fonctions `SECURITY DEFINER` appelées avec la clé anon.

**Conséquence à tenir** : rien de confidentiel ne doit entrer dans ce dépôt.
Ni jeton, ni mot de passe, ni donnée de porteur de projet, ni document
contractuel. Si cette règle ne peut plus être tenue, il faut repasser le dépôt
en privé et basculer sur le déploiement par GitHub Actions.

## Configuration de la base

Les identifiants Supabase sont inscrits dans `src/lib/config.ts`, avec les
variables d'environnement en priorité et ces valeurs en repli. Un déploiement ne
demande donc **aucune configuration** sur Vercel.

Le revers, appris à nos dépens : ces valeurs de repli décident réellement de la
base utilisée dès qu'aucune variable d'environnement n'est définie — ce qui est
le cas par défaut sur un nouveau projet Vercel. **Changer de projet Supabase
impose de changer ces deux lignes**, sinon rien ne bascule.

Pour surcharger malgré tout (Settings → Environment Variables) :

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref-du-projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon publique>
NEXT_PUBLIC_APP_URL=https://<domaine de production>
```

## Déployer

**Tout `push` sur `main` déclenche un déploiement en production**, par
l'intégration Git native de Vercel. Il n'y a rien à lancer à la main, aucun
jeton, aucun workflow.

### Repli : déploiement depuis un poste

```bash
npx --yes vercel@latest deploy --prod
```

Le jeton se crée sur Vercel (Settings → Tokens) et se range dans un fichier
`deploy.env` **non versionné** (déjà couvert par `.gitignore`). Ne jamais le
coller dans un fichier suivi par git ni dans une conversation.

## Vérifier qu'un déploiement a réellement abouti

Un état « READY » côté Vercel ne prouve rien : un déploiement partiel affiche
READY tout en servant une application cassée. La seule vérification qui compte
est une vraie requête HTTP sur une route protégée :

```bash
curl -o /dev/null -s -w "%{http_code}\n" https://<domaine>/login    # attendu : 200
curl -o /dev/null -s -w "%{http_code}\n" https://<domaine>/projets  # attendu : 307 vers /login
curl -o /dev/null -s -w "%{http_code}\n" https://<domaine>/a-propos # attendu : 200
```

`/projets` est le test qui compte : il échoue en 404 quand l'arborescence
déployée est incomplète, alors que la page d'accueil paraît normale à un
utilisateur déjà connecté.

## Recréer la base

Voir `supabase/README.md`. Les 10 migrations versionnées reconstituent le
schéma complet sur un projet vierge.

## Contraintes acceptées du plan gratuit

Décision assumée pour la phase de démonstration, à revoir avant toute mise en
service avec de vraies données de porteurs :

- **Supabase Free** : mise en pause après 7 jours d'inactivité (contournée par
  `.github/workflows/keep-alive.yml`), et **aucune sauvegarde automatique**.
- **Vercel Hobby** : réservé par les conditions d'utilisation à un usage
  personnel non commercial, pas d'équipe, pas de protection par mot de passe
  sur les déploiements de prévisualisation.
