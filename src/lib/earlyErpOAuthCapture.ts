// Must be imported first in main.tsx, before any module that constructs a
// Supabase client — same reasoning as earlyBuyerOAuthCapture.ts. The Olist ERP
// OAuth2 callback lands on this app's own dashboard route with a `?code=` param
// that has nothing to do with Supabase Auth, but the merchant `supabase` client
// (detectSessionInUrl: true) doesn't know that: it auto-detects any `?code=` on
// any route as its own PKCE flow returning, finds no matching code_verifier
// (this flow was never started via signInWithOAuth), and throws "invalid flow
// state, no valid flow state found". Stripping the code here, before that
// client's module loads, stops it from ever seeing it; the callback page reads
// the stash instead of the live URL to complete its own explicit code exchange
// against merchant-erp-settings.
const ERP_OAUTH_URL_KEY = 'vitrineturbo_erp_oauth_url';

if (window.location.pathname === '/dashboard/settings/integrations/olist/callback') {
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    sessionStorage.setItem(ERP_OAUTH_URL_KEY, window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState(null, '', url.toString());
  }
}

export {};
