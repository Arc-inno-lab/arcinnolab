// Identifiants publics du projet Supabase ArcInnoLab.
// Sûrs à committer : la clé "anon" est conçue pour être exposée côté client — c'est la Row
// Level Security (voir les migrations SQL) qui protège les données, pas le secret de cette clé.
// En les intégrant ici plutôt que via des variables d'environnement Vercel, le déploiement ne
// nécessite aucune configuration manuelle : `vercel deploy` suffit.
//
// ATTENTION — ces valeurs de repli ne sont pas décoratives : elles déterminent à quelle base
// l'application se connecte réellement dès que les variables d'environnement ne sont pas
// définies, ce qui est le cas par défaut sur un nouveau projet Vercel. En septembre 2026, les
// anciennes valeurs laissées ici ont fait que l'application continuait de servir l'ancienne
// base du compte KMØ alors que tout le reste avait été migré. Si vous changez de projet
// Supabase, changez ces deux lignes — sinon la migration n'a pas lieu.
//
// Projet Supabase : arcinnolab (organisation ArcInnoLab, région eu-west-1).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://poewilykmxwpxqvkrrjq.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZXdpbHlrbXh3cHhxdmtycmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDU1NDcsImV4cCI6MjEwNDYyMTU0N30.LbAyZIGSoMA8UBajxpVsCeEYhDxtRA_0mDirqgAszLI";

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://arcinnolab.vercel.app";
