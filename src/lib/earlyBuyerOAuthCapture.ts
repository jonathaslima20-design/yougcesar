// Must be imported first in main.tsx, before any module that constructs a
// Supabase client. The merchant `supabase` client (src/lib/supabase.ts) has
// detectSessionInUrl: true and is a singleton built as soon as its module is
// loaded anywhere in the app (main.tsx pulls it in via validateSession()
// before React even mounts). If the URL has a PKCE `?code=`, that client
// races the buyer client (supabaseBuyer, detectSessionInUrl: false) to
// consume it — and loses, since it never initiated this flow and has no
// matching code_verifier, throwing "invalid flow state, no valid flow state
// found". Stripping the code from the visible URL here, before the merchant
// client exists, stops it from ever seeing it; the original URL is stashed
// so the buyer callback page can still complete its own explicit exchange.
const BUYER_OAUTH_URL_KEY = 'vitrineturbo_buyer_oauth_url';

if (window.location.pathname === '/conta/auth/callback') {
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    sessionStorage.setItem(BUYER_OAUTH_URL_KEY, window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState(null, '', url.toString());
  }
}

export {};
