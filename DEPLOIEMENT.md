# Déploiement ArcInnoLab

## Où vit quoi

| | Service | Compte |
|---|---|---|
| Code | GitHub | organisation `arcinnolab` |
| Base + Auth + Stockage | Supabase | organisation `ArcInnoLab`, projet `arcinnolab` |
| Hébergement | Vercel | compte `arcinnolab` |

Ces trois comptes sont rattachés à l'adresse dédiée du projet, **pas** à un
compte personnel ni à l'environnement KMØ. C'est délibéré : la plateforme est
financée par un consortium et doit pouvoir lui être remise sans dépendre d'une
personne. La double authentification est active sur le compte propriétaire.

Sur GitHub et Supabase, chaque membre est invité **nominativement** avec son
propre compte — jamais par partage du mot de passe. Vercel, sur son plan
gratuit, ne gère pas d'équipe : ce compte reste donc mono-utilisateur.

## Variables d'environnement

À déclarer sur Vercel (Settings → Environment Variables), pour les trois
environnements (Production, Preview, Development) :

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref-du-projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon publique>
NEXT_PUBLIC_APP_URL=https://<domaine de production>
```

Aucune clé `service_role` n'est nécessaire : toute la création de comptes passe
par des fonctions Postgres `SECURITY DEFINER` appelées avec la clé anon
(voir `supabase/migrations/…_002_auth_functions.sql`). C'est un choix de
conception — il n'y a aucun secret sensible à configurer côté hébergement.

## Déployer

Le dépôt GitHub est relié à Vercel : **tout `push` sur `main` déclenche un
déploiement en production**. C'est la voie normale, il n'y a rien à lancer à la
main.

### Repli : déploiement depuis un poste

Si l'intégration GitHub est indisponible :

```bash
npx --yes vercel@latest deploy --prod --yes --token="$VERCEL_TOKEN"
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
