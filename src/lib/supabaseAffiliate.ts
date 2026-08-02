import { createClient } from '@supabase/supabase-js';

// Independent Supabase client dedicated to the affiliate identity (see
// src/lib/supabaseBuyer.ts for the same rationale applied to buyers). A
// Supabase JS client only holds one auth session at a time internally, so
// reusing the merchant `supabase` client — or the `supabaseBuyer` client —
// here would silently replace whichever session was already active the
// moment an affiliate logs in on /afiliado/* in the same browser tab. Its
// own `storageKey` keeps the affiliate session in a separate localStorage
// slot, fully isolated from the merchant and buyer sessions.
//
// No OAuth support in v1 (detectSessionInUrl: false, email/password login
// only) — deliberately, to sidestep the "?code= race" bug documented for the
// buyer client (src/lib/earlyBuyerOAuthCapture.ts): the merchant client's
// detectSessionInUrl:true auto-detection would otherwise race any OAuth
// callback route added for a third client too. If affiliate OAuth is ever
// needed, it must get the same early-capture treatment as the buyer flow.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

export const supabaseAffiliate = createClient(supabaseUrl || FALLBACK_URL, supabaseAnonKey || FALLBACK_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: localStorage,
    storageKey: 'vitrineturbo-affiliate-auth',
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'vitrineturbo-affiliate-web',
    },
  },
  db: {
    schema: 'public',
  },
});

supabaseAffiliate.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    ['vitrineturbo_affiliate_user', 'vitrineturbo_affiliate_session'].forEach(
      (key) => localStorage.removeItem(key)
    );
  }
});

export default supabaseAffiliate;
