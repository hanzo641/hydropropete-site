import './localStorageInstall';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const isSupabaseConfigured = url.length > 0 && key.length > 0;

/**
 * Client Supabase de l'app (clé publique « publishable » / anon uniquement : la sécurité
 * repose sur la RLS et les fonctions serveur). Session stockée dans SQLite (localStorage).
 */
export const supabase = createClient(url || 'http://localhost:54321', key || 'public-anon-key', {
  auth: {
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Rafraîchissement du jeton uniquement quand l'app est au premier plan (recommandation Supabase).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
