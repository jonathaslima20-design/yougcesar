interface CategoryOrderSetting {
  category: string;
  order: number;
  enabled: boolean;
}

/**
 * Applies the merchant's category show/hide + order choices (Configurações → Vitrine,
 * `CategoryDisplaySettings.tsx` / `user_storefront_settings.categoryDisplaySettings`)
 * to a raw category list. A store that never opened that screen has no settings, so
 * every category still shows, alphabetically — unchanged from today.
 */
export function applyCategoryDisplayOrder(categories: string[], settings: CategoryOrderSetting[] | undefined): string[] {
  if (!settings || settings.length === 0) return categories;

  const byName = new Map(settings.map((s) => [s.category, s]));
  return categories
    .filter((category) => byName.get(category)?.enabled !== false)
    .sort((a, b) => {
      const orderA = byName.get(a)?.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = byName.get(b)?.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
}
