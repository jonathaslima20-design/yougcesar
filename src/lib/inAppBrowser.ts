// Detects browsers embedded inside another app (WhatsApp, Instagram, Facebook,
// TikTok, etc). Google blocks or silently breaks its OAuth flow in these
// webviews — see earlyBuyerOAuthCapture.ts and buyerAuth.ts for the PKCE
// fallout this causes. Used to escape before buyers/merchants hit that dead end.
//
// User-agent sniffing only catches apps that choose to tag themselves (most
// do on Android; on iOS it's inconsistent — WhatsApp doesn't, and some builds
// even spoof a Chrome-looking UA). window.outerWidth===0 is a commonly cited
// extra signal for iOS webviews, but isn't reliable across every WhatsApp
// build either (confirmed empirically: a real device reported outerWidth=414,
// the full screen width, while still being the broken embedded browser). So
// this detection is "best effort, catches the common cases" — the reliable
// backstop is CONFIRMED_BROKEN_KEY below, set only after we've actually
// observed the PKCE exchange fail, which is proof positive regardless of what
// the UA or window size claimed.
const IN_APP_BROWSER_PATTERN = /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|TikTok|musical_ly/i;

export const CONFIRMED_BROKEN_BROWSER_KEY = 'vt_confirmed_broken_browser';

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || navigator.vendor || '';
  if (IN_APP_BROWSER_PATTERN.test(ua)) return true;
  if (isIOS() && window.outerWidth === 0 && window.outerHeight === 0) return true;
  if (sessionStorage.getItem(CONFIRMED_BROKEN_BROWSER_KEY) === '1') return true;
  return false;
}

// Best-effort escape URL for the current page: Android hands off to Chrome via
// an intent: URL (falls back to whatever browser the OS resolves https: to if
// Chrome isn't installed); iOS hands off to Safari via x-safari-https:, since
// Safari always exists on the device regardless of what's set as default.
export function buildEscapeHref(): string | null {
  const url = window.location.href;
  const withoutScheme = url.replace(/^https?:\/\//, '');
  if (isAndroid()) {
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  if (isIOS()) {
    return `x-safari-https://${withoutScheme}`;
  }
  return null;
}

// Marks the current browser context as confirmed-broken (the PKCE exchange
// just failed in it) and makes a best-effort attempt to leave it right away.
// Persists across the redirect back to the login page (same tab, same
// sessionStorage) so isInAppBrowser() — and the escape button — stay on even
// though the UA/window-size heuristics above never fired for this browser.
export function escapeConfirmedBrokenBrowser(): void {
  sessionStorage.setItem(CONFIRMED_BROKEN_BROWSER_KEY, '1');
  const href = buildEscapeHref();
  if (href) window.location.replace(href);
}
