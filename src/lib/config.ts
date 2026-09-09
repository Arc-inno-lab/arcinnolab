// Identifiants publics du projet Supabase ArcInnoLab.
// Sûrs à committer : la clé "anon" est conçue pour être exposée côté client — c'est la Row
// Level Security (voir les migrations SQL) qui protège les données, pas le secret de cette clé.
// En les intégrant ici plutôt que via des variables d'environnement Vercel, le déploiement ne
// nécessite aucune configuration manuelle : `vercel deploy` suffit.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yroracashcbkpzidswyo.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyb3JhY2FzaGNia3B6aWRzd3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NDc0MTIsImV4cCI6MjEwNDUyMzQxMn0.ZT-t5cnioYnYom3t8ftMh827P9BA1UE7FsGhMBndEsg";

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://arcinnolab.vercel.app";
