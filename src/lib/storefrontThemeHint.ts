/**
 * A tiny, purely client-side memory of which theme a store's home (`/:slug`)
 * last rendered as — written by CorretorPage/ProductDetailsPage once the real
 * theme is known, read synchronously by Footer.tsx on its very first render.
 *
 * Why: whether to show the platform's generic footer (PublicLayout's <Footer/>,
 * which "padrão" stores rely on as their own footer) depends on the store's
 * theme, but that theme is only known after an async fetch resolves. During
 * that loading window the real signal (a data-hide-platform-footer attribute
 * set by StorefrontThemeContext) doesn't exist yet, so on a fresh page load
 * Footer had no way to know and defaulted to "show" — flashing the wrong
 * footer under an eletrônicos store's own loading spinner. This hint lets a
 * RETURNING visit to the same store guess correctly from the first paint;
 * a brand-new store's very first-ever visit still gets one unavoidable flash.
 */

const PREFIX = 'sf-theme-hint:';

/** First path segment of a storefront URL, e.g. "/kingstore/produtos/x" -> "kingstore". */
export function slugFromPathname(pathname: string): string | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return segment || null;
}

export function rememberStorefrontTheme(slug: string | null | undefined, themeId: string): void {
  if (!slug) return;
  try {
    localStorage.setItem(PREFIX + slug, themeId);
  } catch {
    // Storage disabled/full — the hint is a nice-to-have, never required.
  }
}

export function getRememberedStorefrontTheme(slug: string | null | undefined): string | null {
  if (!slug) return null;
  try {
    return localStorage.getItem(PREFIX + slug);
  } catch {
    return null;
  }
}
