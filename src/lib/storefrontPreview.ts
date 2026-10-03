import { getStoredUser, isAuthenticated } from '@/lib/auth/simpleAuth';
import type { StorefrontThemeId } from '@/lib/appearanceDefaults';

export const PREVIEW_THEME_PARAM = 'preview_theme';

/**
 * Theme the owner asked to preview with `?preview_theme=eletronicos` (the "Visualizar loja"
 * button in the E-commerce customize screen). Honored only for the store's own logged-in
 * owner and only for the E-commerce theme. Everyone else — visitors included — gets null
 * and keeps the theme the store has active.
 */
export function getOwnerPreviewTheme(storeOwnerId: string | null | undefined): StorefrontThemeId | null {
  if (typeof window === 'undefined' || !storeOwnerId) return null;
  const requested = new URLSearchParams(window.location.search).get(PREVIEW_THEME_PARAM);
  if (requested !== 'eletronicos') return null;
  if (!isAuthenticated()) return null;
  return getStoredUser()?.id === storeOwnerId ? 'eletronicos' : null;
}
