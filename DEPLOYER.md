# ArcInnoLab — refonte UX/UI, prête à déployer

Ce dossier contient l'application complète (Next.js 16 + Supabase), build validé.

## Déployer en 2 minutes depuis ton Mac

```bash
cd arcinnolab
npm install
npx vercel --prod        # se connecte à ton compte Vercel, puis déploie
```

C'est tout. Aucune variable d'environnement à configurer : les identifiants
publics Supabase sont dans `src/lib/config.ts` (la clé anon est faite pour être
exposée, c'est la RLS qui protège les données).

## Ce que contient cette version

- Tableau de bord d'accueil : KPI, annuaire des partenaires avec contact direct,
  fil d'activité, bandeau des logos partenaires/financeurs
- Kanban des étapes (glisser-déposer) sur le passeport projet
- Tags d'état colorés (remplacent les menus déroulants)
- Sous-fil de discussion + pièces jointes sur chaque étape
- Logo par projet, photo de profil, avatars partout
- Fiche porteur enrichie à l'invitation (nom, prénom, organisation)
- Messagerie directe 1:1 entre membres
- Page de connexion retravaillée (dégradé de marque + visuel)
