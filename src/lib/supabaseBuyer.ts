import { createClient } from '@supabase/supabase-js';

// Independent Supabase client dedicated to the buyer/customer identity.
// A Supabase JS client only holds one auth session at a time internally, so
// reusing the merchant `supabase` client (src/lib/supabase.ts) here would
// silently replace a logged-in merchant's session (or vice versa) the moment
// a customer logs in on a storefront page in the same browser tab. Giving
// this client its own `storageKey` keeps the two sessions in separate
// localStorage slots, fully isolated from each other.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

export const supabaseBuyer = createClient(supabaseUrl || FALLBACK_URL, supabaseAnonKey || FALLBACK_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // buyer OAuth (/conta/auth/callback) exchanges the code manually instead
    storage: localStorage,
    storageKey: 'vitrineturbo-buyer-auth',
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'vitrineturbo-buyer-web',
    },
  },
  db: {
    schema: 'public',
  },
});

supabaseBuyer.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    ['vitrineturbo_buyer_user', 'vitrineturbo_buyer_session', 'vitrineturbo_buyer_auth_state'].forEach(
      (key) => localStorage.removeItem(key)
    );
  }
});

export default supabaseBuyer;
