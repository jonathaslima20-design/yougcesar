import type { StorefrontAppearance } from '@/lib/appearanceDefaults';

/**
 * Client-side cache of a store's resolved storefront_appearance row, shared by
 * every page that mounts its own StorefrontThemeProvider (CorretorPage,
 * ProductDetailsPage). Without it, each fresh mount starts from
 * DEFAULT_APPEARANCE/the system appearance while its own fetch is in flight —
 * on a store with a customized footer logo, that's a real (if brief) flash of
 * the platform's default footer under every single product page view, not
 * just a first-ever visit.
 */

// v2: keyed by theme too, since a store now holds one appearance row per theme
// instead of a single shared row — bump the prefix so old (pre-split) cached
// blobs, which lack header_bg_color/header_text_color/top_bar_text, never get served.
const APPEARANCE_CACHE_PREFIX = 'sf-theme-v2-';
const APPEARANCE_CACHE_TTL = 24 * 60 * 60 * 1000;

export function getCachedAppearance(userId: string, themeId: string): StorefrontAppearance | null {
  try {
    const raw = localStorage.getItem(`${APPEARANCE_CACHE_PREFIX}${userId}-${themeId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > APPEARANCE_CACHE_TTL) {
      localStorage.removeItem(`${APPEARANCE_CACHE_PREFIX}${userId}-${themeId}`);
      return null;
    }
    return data as StorefrontAppearance;
  } catch {
    return null;
  }
}

export function setCachedAppearance(userId: string, themeId: string, data: StorefrontAppearance): void {
  try {
    localStorage.setItem(
      `${APPEARANCE_CACHE_PREFIX}${userId}-${themeId}`,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // Storage disabled/full — the cache is a nice-to-have, never required.
  }
}
