// Detects browsers embedded inside another app (WhatsApp, Instagram, Facebook,
// TikTok, etc). Google blocks or silently breaks its OAuth flow in these
// webviews — see earlyBuyerOAuthCapture.ts and buyerAuth.ts for the PKCE
// fallout this causes. Used to escape before buyers/merchants hit that dead end.
const IN_APP_BROWSER_PATTERN = /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|TikTok|musical_ly/i;

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || navigator.vendor || '';
  if (IN_APP_BROWSER_PATTERN.test(ua)) return true;

  // Several iOS apps — WhatsApp included — don't tag their embedded browser's
  // user agent at all, and some even spoof it to look like Chrome/Safari
  // specifically to dodge Google's "disallowed_useragent" OAuth block. A real
  // standalone browser always reports its outer window size; a webview
  // embedded in another app reports 0, since it isn't a real top-level
  // browser window. This catches what the user agent string can't.
  if (isIOS() && window.outerWidth === 0 && window.outerHeight === 0) return true;

  return false;
}
