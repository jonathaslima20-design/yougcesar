// Must be imported first in main.tsx, before anything else runs. WhatsApp,
// Instagram and similar apps open links in an embedded webview with its own
// storage, isolated from the system browser — this breaks Google OAuth's PKCE
// exchange (see buyerAuth.ts/simpleAuth.ts) and Google sometimes refuses to
// even show its login screen to a webview's user agent at all. On Android we
// can jump straight to Chrome via an intent: URL before the page finishes
// loading, so by the time the user reaches login they're already in a real
// browser. Some webviews block a non-user-initiated navigation to a custom
// scheme like this one — when that happens, InAppBrowserEscapeButton.tsx is
// the one-tap fallback (a real tap is a user gesture, so it isn't blocked).
// iOS has no onload equivalent at all, hence no branch for it here.
import { isInAppBrowser } from './inAppBrowser';

const ESCAPE_ATTEMPTED_KEY = 'vt_in_app_browser_escape_attempted';

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

if (isInAppBrowser() && isAndroid() && !sessionStorage.getItem(ESCAPE_ATTEMPTED_KEY)) {
  sessionStorage.setItem(ESCAPE_ATTEMPTED_KEY, '1');
  const target = window.location.href;
  const withoutScheme = target.replace(/^https?:\/\//, '');
  window.location.replace(
    `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target)};end`
  );
}

export {};
