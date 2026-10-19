import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/**
 * Client Supabase. `null` si les variables d'environnement ne sont pas
 * renseignées : l'application bascule alors en « mode démo » (données
 * locales d'exemple, clairement identifiées) au lieu de casser.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;

/** Clé publishable (publique) — nécessaire pour appeler les edge functions. */
export const publishableKey: string | undefined = key;
export const supabaseUrl: string | undefined = url;
