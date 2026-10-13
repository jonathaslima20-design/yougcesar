// Detects browsers embedded inside another app (WhatsApp, Instagram, Facebook,
// TikTok, etc). Google blocks or silently breaks its OAuth flow in these
// webviews — see earlyBuyerOAuthCapture.ts and buyerAuth.ts for the PKCE
// fallout this causes. Used to warn buyers before they hit that dead end.
const IN_APP_BROWSER_PATTERN = /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|TikTok|musical_ly/i;

export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || navigator.vendor || '';
  return IN_APP_BROWSER_PATTERN.test(ua);
}
