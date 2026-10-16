import { isCustomDomainHostname } from '@/lib/customDomain';

/**
 * A tiny, purely client-side memory of what a store's storefront last
 * rendered as — written once the real data is known, read synchronously by
 * Footer.tsx on its very first render (and on every subsequent one).
 *
 * Why: whether to show the platform's generic footer/logo (PublicLayout's
 * <Footer/>) depends on the store's theme and appearance, but those are only
 * known after an async fetch resolves — and that fetch re-runs on every page
 * (CorretorPage, ProductDetailsPage each mount their own StorefrontThemeProvider).
 * During that gap the real signal (data-* attributes set by
 * StorefrontThemeContext) doesn't exist yet, so Footer has no way to know and
 * defaults to "show the platform's own branding" — flashing it under the next
 * page's loading spinner, even mid-session when the user was already on this
 * exact store a second ago. This hint lets Footer guess correctly from the
 * first paint instead; a brand-new store's very first-ever visit still gets
 * one unavoidable flash.
 */

const THEME_PREFIX = 'sf-theme-hint:';
const FOOTER_LOGO_PREFIX = 'sf-footer-logo-hint:';

/** First path segment of a storefront URL, e.g. "/kingstore/produtos/x" -> "kingstore". */
export function slugFromPathname(pathname: string): string | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment || null;
}

/**
 * Key a hint by store. On the shared vitrineturbo.com origin, many stores live
 * under different path slugs, so the slug is the key. On a merchant's own
 * custom domain there's no slug in the URL (and resolving the real slug needs
 * its own async DB lookup) — but the origin alone already identifies exactly
 * one store, and localStorage is already scoped per-origin by the browser, so
 * the hostname itself is a perfectly good, synchronously-available key there.
 */
function storefrontHintKey(pathname: string): string | null {
  const hostname = window.location.hostname;
  if (isCustomDomainHostname(hostname)) return hostname;
  return slugFromPathname(pathname);
}

export function rememberStorefrontTheme(pathname: string, themeId: string): void {
  const key = storefrontHintKey(pathname);
  if (!key) return;
  try {
    localStorage.setItem(THEME_PREFIX + key, themeId);
  } catch {
    // Storage disabled/full — the hint is a nice-to-have, never required.
  }
}

export function getRememberedStorefrontTheme(pathname: string): string | null {
  const key = storefrontHintKey(pathname);
  if (!key) return null;
  try {
    return localStorage.getItem(THEME_PREFIX + key);
  } catch {
    return null;
  }
}

export interface FooterLogoHint {
  mode: string;
  format: string;
  logoUrl: string | null;
}

export function rememberFooterLogoHint(pathname: string, hint: FooterLogoHint): void {
  const key = storefrontHintKey(pathname);
  if (!key) return;
  try {
    localStorage.setItem(FOOTER_LOGO_PREFIX + key, JSON.stringify(hint));
  } catch {
    // Storage disabled/full — the hint is a nice-to-have, never required.
  }
}

export function getRememberedFooterLogoHint(pathname: string): FooterLogoHint | null {
  const key = storefrontHintKey(pathname);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(FOOTER_LOGO_PREFIX + key);
    return raw ? (JSON.parse(raw) as FooterLogoHint) : null;
  } catch {
    return null;
  }
}
