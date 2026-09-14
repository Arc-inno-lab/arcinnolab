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

/**
 * Adresse publique de la plateforme, utilisée pour fabriquer les liens
 * d'invitation (voir `src/app/actions.ts`). Une valeur erronée ici n'a rien
 * d'anodin : les personnes invitées atterrissent sur un autre site, où leur
 * jeton n'existe pas, et toutes les invitations échouent.
 *
 * L'ordre de priorité évite ce piège :
 *  1. NEXT_PUBLIC_APP_URL, si on veut forcer une adresse (domaine personnalisé).
 *  2. VERCEL_PROJECT_PRODUCTION_URL, fournie automatiquement par Vercel et
 *     toujours à jour — y compris après un changement de nom de projet. Elle
 *     n'est lisible que côté serveur, ce qui suffit : les liens d'invitation
 *     sont fabriqués dans une server action.
 *  3. En dernier recours, l'adresse de production connue au 14/09/2026.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://arcinnolab-five.vercel.app");
