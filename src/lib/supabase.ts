import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables d'environnement Supabase manquantes. " +
      'Renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local',
  );
}

/**
 * Normalise l'URL du projet : `supabase-js` ajoute lui-meme `/rest/v1`.
 * On retire donc un eventuel slash final ou suffixe `/rest/v1` colle par erreur
 * (l'URL attendue est de la forme `https://<projet>.supabase.co`).
 */
const supabaseUrl = rawUrl
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '')
  .replace(/\/+$/, '');

// Client non type : les resultats sont castes vers les types de `@/types/database`
// au niveau de chaque appel (cf. Desk / Booking).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
