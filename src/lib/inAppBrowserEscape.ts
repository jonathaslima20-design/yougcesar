// Must be imported first in main.tsx, before anything else runs. WhatsApp,
// Instagram and similar apps open links in an embedded webview, and that
// webview's local storage doesn't reliably survive the round trip through
// Google's OAuth screen — sometimes because the webview hands off to a
// separate real browser app that has its own storage, sometimes because the
// webview itself uses a non-persistent (ephemeral) data store that's wiped on
// every navigation. Either way, by the time the user reaches login they need
// to already be in a real, persistent browser — see buyerAuth.ts/simpleAuth.ts
// for the PKCE "invalid flow state" error this produces otherwise.
//
// This onload attempt only fires when isInAppBrowser() already recognizes the
// browser (UA tag, or the iOS window-size heuristic) — it can't catch a case
// that only reveals itself once the OAuth exchange actually fails (see
// escapeConfirmedBrokenBrowser() in inAppBrowser.ts, triggered reactively from
// buyerAuth.ts instead). Some webviews also block a scheme navigation that
// isn't a user gesture, so none of this is guaranteed — InAppBrowserEscapeButton.tsx
// is the one-tap fallback that works wherever the automatic attempt can't
// (a real tap is a user gesture, so it isn't blocked).
import { isInAppBrowser, buildEscapeHref } from './inAppBrowser';

const ESCAPE_ATTEMPTED_KEY = 'vt_in_app_browser_escape_attempted';

if (isInAppBrowser() && !sessionStorage.getItem(ESCAPE_ATTEMPTED_KEY)) {
  sessionStorage.setItem(ESCAPE_ATTEMPTED_KEY, '1');
  const href = buildEscapeHref();
  if (href) window.location.replace(href);
}

export {};
