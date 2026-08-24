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

// Same-named cities in different states are common in Brazil (Bom Jesus,
// Santa Rita, ...) — city name alone isn't enough to call a buyer "local".
// Empty-safe on either side: city+state are always written together by the
// store-CEP lookup flow (CheckoutSettingsContent.tsx), so a missing state
// only happens on legacy data, and we don't want to suddenly block a
// merchant's working local delivery over that.
export function statesMatch(
  merchantState: string | null | undefined,
  buyerState: string | null | undefined
): boolean {
  if (!merchantState || !buyerState) return true;
  return merchantState.trim().toLowerCase() === buyerState.trim().toLowerCase();
}

interface DeliveryOptionLike {
  enabled: boolean;
  scope?: 'local' | 'national' | 'pickup';
  calculationType?: string;
  regions?: string[];
  quoteOnRequest?: boolean;
}

interface FilterEligibleDeliveryOptionsParams {
  merchantCity?: string | null;
  merchantState?: string | null;
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
  // "Frete a Consultar" options have no closed value to charge, so every
  // online-payment flow must pass this — only the WhatsApp order flow leaves
  // it false and lets buyers pick them.
  excludeQuoteOnRequest?: boolean;
}

export function filterEligibleDeliveryOptions<T extends DeliveryOptionLike>(
  options: T[],
  { merchantCity, merchantState, buyerCity, buyerState, restrictToLocal = false, skipLocationMatch = false, excludeQuoteOnRequest = false }: FilterEligibleDeliveryOptionsParams
): T[] {
  return options.filter((d) => {
    if (!d.enabled) return false;
    if (excludeQuoteOnRequest && d.quoteOnRequest) return false;
    // Pickup has no shipping destination to validate — the buyer travels to
    // the store regardless of where they live, so it's always eligible and
    // exempt from every location gate below (CEP requirement, WhatsApp-tab
    // local-only restriction, city/state match).
    if (d.scope === 'pickup') return true;
    if (skipLocationMatch) return true;
    if (d.scope === 'local') {
      return citiesMatch(merchantCity, buyerCity) && statesMatch(merchantState, buyerState);
    }
    if (restrictToLocal) return false;
    if (d.calculationType === 'region' && buyerState) {
      return (d.regions || []).includes(buyerState);
    }
    return true;
  });
}

interface PickupDetailsLike {
  pickupInstructions?: string | null;
  pickupHours?: string | null;
  pickupMapUrl?: string | null;
}

// Folds the pickup option's live-editable fields into the single free-text
// snapshot stored on the order (orders.pickup_instructions) at order-creation
// time. Avoids a DB migration for pickupHours/pickupMapUrl — order history
// already only ever shows this one text column (see OrderPickupInfo), and
// like the rest of the order it must survive the merchant later editing or
// deleting the delivery option.
export function buildPickupInstructionsSnapshot(option: PickupDetailsLike | null | undefined): string | null {
  if (!option) return null;
  const parts: string[] = [];
  if (option.pickupInstructions?.trim()) parts.push(option.pickupInstructions.trim());
  if (option.pickupHours?.trim()) parts.push(`Horário: ${option.pickupHours.trim()}`);
  if (option.pickupMapUrl?.trim()) parts.push(`Ver no mapa: ${option.pickupMapUrl.trim()}`);
  return parts.length > 0 ? parts.join('\n') : null;
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
