import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client "service_role" — usage strictement serveur (jamais importé côté client).
// Nécessaire pour créer des comptes Auth (bootstrap admin, création partenaire,
// acceptation d'invitation porteur) sans passer par l'auto-inscription publique.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante. Définissez cette variable d'environnement (Project Settings > API sur Supabase)."
    );
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
