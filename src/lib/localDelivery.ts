// Shared local-delivery eligibility logic, used by both CartModal.tsx (cart/WhatsApp
// checkout) and CheckoutAddressPage.tsx (online-payment checkout) so the two flows can't
// silently drift apart on what counts as "local".

// Case + diacritic-insensitive comparison ("São Paulo" / "SAO PAULO" / "sao paulo" all match).
// Typos and alternate city names are an accepted residual risk — no fuzzy matching.
export function normalizeCityName(city: string): string {
  return city
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

export function citiesMatch(
  merchantCity: string | null | undefined,
  buyerCity: string | null | undefined
): boolean {
  if (!merchantCity || !buyerCity) return false;
  return normalizeCityName(merchantCity) === normalizeCityName(buyerCity);
}

interface DeliveryOptionLike {
  enabled: boolean;
  scope?: 'local' | 'national';
  calculationType?: string;
  regions?: string[];
}

interface FilterEligibleDeliveryOptionsParams {
  merchantCity?: string | null;
  buyerCity?: string | null;
  buyerState?: string | null;
  // WhatsApp checkout must never offer national delivery — only local options
  // are selectable there. Online-payment checkout keeps the full list.
  restrictToLocal?: boolean;
  // Merchant opted out of CEP/city matching entirely (settings.requireDeliveryCep
  // === false) — e.g. a store that only ships nationwide and doesn't want buyers
  // gated on a CEP lookup. Every enabled option is shown, scope and
  // restrictToLocal are both ignored.
  skipLocationMatch?: boolean;
}

export function filterEligibleDeliveryOptions<T extends DeliveryOptionLike>(
  options: T[],
  { merchantCity, buyerCity, buyerState, restrictToLocal = false, skipLocationMatch = false }: FilterEligibleDeliveryOptionsParams
): T[] {
  return options.filter((d) => {
    if (!d.enabled) return false;
    if (skipLocationMatch) return true;
    const scope = d.scope === 'local' ? 'local' : 'national';
    if (scope === 'local') {
      return citiesMatch(merchantCity, buyerCity);
    }
    if (restrictToLocal) return false;
    if (d.calculationType === 'region' && buyerState) {
      return (d.regions || []).includes(buyerState);
    }
    return true;
  });
}

export function hasNoMatchingLocalOption(
  eligibleCount: number,
  buyerCity: string | null | undefined,
  allOptions: DeliveryOptionLike[],
  skipLocationMatch = false
): boolean {
  if (skipLocationMatch) return false;
  return eligibleCount === 0 && !!buyerCity && allOptions.some((d) => d.enabled && d.scope === 'local');
}
