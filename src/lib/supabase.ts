import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variables d'environnement Supabase manquantes. " +
      'Renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local',
  );
}

// Client non type : les resultats sont castes vers les types de `@/types/database`
// au niveau de chaque appel (cf. Desk / Booking).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
