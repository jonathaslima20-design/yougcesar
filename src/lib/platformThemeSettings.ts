import { supabase } from '@/lib/supabase';
import type { StorefrontThemeId } from '@/lib/appearanceDefaults';

export interface PlatformThemeSettings {
  /** Global switch: "Eletrônicos" is available to every merchant. */
  eletronicosEnabled: boolean;
  /** Merchants who get "Eletrônicos" even while the global switch is off. */
  eletronicosAllowedUserIds: string[];
}

const CLOSED: PlatformThemeSettings = { eletronicosEnabled: false, eletronicosAllowedUserIds: [] };

// One shared request per page load: the storefront, the product page and the
// dashboard picker all need this, and it almost never changes.
let cached: Promise<PlatformThemeSettings> | null = null;

/** Fails closed (theme hidden) if the settings can't be read. */
export function fetchPlatformThemeSettings(): Promise<PlatformThemeSettings> {
  if (!cached) {
    cached = (async () => {
      const { data, error } = await supabase
        .from('platform_theme_settings')
        .select('eletronicos_theme_enabled, eletronicos_allowed_user_ids')
        .maybeSingle();
      if (error) {
        console.error('Error fetching platform theme settings:', error);
        cached = null; // let the next caller retry
        return CLOSED;
      }
      return {
        eletronicosEnabled: data?.eletronicos_theme_enabled ?? false,
        eletronicosAllowedUserIds: data?.eletronicos_allowed_user_ids ?? [],
      };
    })();
  }
  return cached;
}

export async function savePlatformThemeSettings(settings: PlatformThemeSettings): Promise<void> {
  const { error } = await supabase.from('platform_theme_settings').upsert({
    id: 1,
    eletronicos_theme_enabled: settings.eletronicosEnabled,
    eletronicos_allowed_user_ids: settings.eletronicosAllowedUserIds,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  cached = Promise.resolve(settings);
}

export function canUseEletronicosTheme(settings: PlatformThemeSettings, userId: string | null | undefined): boolean {
  return settings.eletronicosEnabled || (!!userId && settings.eletronicosAllowedUserIds.includes(userId));
}

/** The theme a store actually renders: "Eletrônicos" falls back to "Padrão" unless enabled for that store. */
export function resolveStorefrontThemeId(
  themeId: StorefrontThemeId | null | undefined,
  settings: PlatformThemeSettings,
  ownerId: string | null | undefined
): StorefrontThemeId {
  if (themeId === 'eletronicos' && canUseEletronicosTheme(settings, ownerId)) return 'eletronicos';
  return 'padrao';
}
