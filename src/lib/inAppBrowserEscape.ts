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
// Android: jump straight to Chrome via an intent: URL before the page finishes
// loading. iOS: attempt the same via the x-safari-https: scheme — Apple has no
// true equivalent, and some webviews block a scheme navigation that isn't a
// user gesture, so this is best-effort. InAppBrowserEscapeButton.tsx is the
// guaranteed one-tap fallback for both platforms when the automatic attempt
// doesn't go through (a real tap is a user gesture, so it isn't blocked).
import { isInAppBrowser } from './inAppBrowser';

const ESCAPE_ATTEMPTED_KEY = 'vt_in_app_browser_escape_attempted';

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

if (isInAppBrowser() && !sessionStorage.getItem(ESCAPE_ATTEMPTED_KEY)) {
  sessionStorage.setItem(ESCAPE_ATTEMPTED_KEY, '1');
  const target = window.location.href;
  const withoutScheme = target.replace(/^https?:\/\//, '');

  if (isAndroid()) {
    window.location.replace(
      `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target)};end`
    );
  } else if (isIOS()) {
    window.location.replace(`x-safari-https://${withoutScheme}`);
  }
}

export {};
