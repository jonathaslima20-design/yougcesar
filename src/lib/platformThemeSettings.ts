import { supabase } from '@/lib/supabase';
import type { StorefrontThemeId } from '@/lib/appearanceDefaults';

// One shared request per page load: the storefront, the product page and the
// dashboard picker all need this flag, and it almost never changes.
let cached: Promise<boolean> | null = null;

/** Whether the "Eletrônicos" theme is switched on platform-wide. Fails closed (false). */
export function fetchEletronicosThemeEnabled(): Promise<boolean> {
  if (!cached) {
    cached = (async () => {
      const { data, error } = await supabase
        .from('platform_theme_settings')
        .select('eletronicos_theme_enabled')
        .maybeSingle();
      if (error) {
        console.error('Error fetching platform theme settings:', error);
        cached = null; // let the next caller retry
        return false;
      }
      return data?.eletronicos_theme_enabled ?? false;
    })();
  }
  return cached;
}

export async function saveEletronicosThemeEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('platform_theme_settings')
    .upsert({ id: 1, eletronicos_theme_enabled: enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
  cached = Promise.resolve(enabled);
}

/** The theme a store actually renders: "Eletrônicos" falls back to "Padrão" while it's switched off. */
export function resolveStorefrontThemeId(
  themeId: StorefrontThemeId | null | undefined,
  eletronicosEnabled: boolean
): StorefrontThemeId {
  if (themeId === 'eletronicos' && eletronicosEnabled) return 'eletronicos';
  return 'padrao';
}
