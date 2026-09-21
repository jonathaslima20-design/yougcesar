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

// Whether the checkout needs to ask the buyer for a CEP at all — purely
// derived from the current delivery configuration, never a merchant
// decision (a manual on/off toggle for this used to exist and could be left
// off by mistake, silently breaking local matching, region filtering, or
// SuperFrete quoting, all three of which depend on knowing where the buyer
// is). CEP is needed exactly when at least one enabled option actually
// reads buyer location: a local-scope option (city match or real distance),
// a region/UF option, or a live SuperFrete quote. Pickup, flat national fee,
// and weight-tier national fee never look at buyer location, so a store
// offering only those doesn't need to ask.
export function isDeliveryCepNeeded(
  deliveryOptions: Pick<DeliveryOptionLike, 'enabled' | 'scope' | 'calculationType'>[],
  superFreteEnabled?: boolean
): boolean {
  if (superFreteEnabled) return true;
  return deliveryOptions.some((d) => d.enabled && (d.scope === 'local' || d.calculationType === 'region'));
}

interface FilterEligibleDeliveryOptionsParams {
  merchantCity?: string | null;
  merchantState?: string | null;
  buyerCity?: string | null;
  buyerState?: string | null;
  // WhatsApp checkout must never offer national delivery — only local options
  // are selectable there. Online-payment checkout keeps the full list.
  restrictToLocal?: boolean;
  // Whether the checkout should skip CEP/city matching entirely — computed
  // by isDeliveryCepNeeded below, never a merchant-set flag. When true,
  // every enabled option is shown, scope and restrictToLocal are both
  // ignored.
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
    // A "Frete a Combinar" option has no fixed delivery radius — the merchant
    // negotiates logistics directly with the buyer afterward, so it stays
    // eligible regardless of where the buyer is, unlike a priced local option
    // which only makes sense within the merchant's own city.
    if (d.scope === 'local') {
      if (d.quoteOnRequest) return true;
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

interface TierLike {
  id: string;
  fee: number;
}

function sortedTiers<T extends TierLike>(tiers: T[] | undefined, boundKey: keyof T): T[] {
  return [...(tiers || [])].sort((a, b) => (a[boundKey] as number) - (b[boundKey] as number));
}

interface DistanceTierOptionLike {
  calculationType?: string;
  distanceTiers?: { id: string; maxDistanceKm: number; fee: number }[];
  localFallbackFee?: number | null;
  fee: number;
}

// A distance-tier option with a real, geocoded distance available is only
// eligible up to its farthest configured tier — a motoboy has a real range
// limit, unlike a weight-tier national option (see resolveWeightTierFee)
// which can always still ship, just at the top tier's price. When
// `distanceKm` is null (either side's CEP couldn't be geocoded), the option
// stays eligible — it falls back to `localFallbackFee`, gated only by the
// pre-existing same-city match already applied in `filterEligibleDeliveryOptions`.
export function isDistanceTierEligible(option: DistanceTierOptionLike, distanceKm: number | null): boolean {
  if (option.calculationType !== 'distance_tier') return true;
  if (distanceKm == null) return true;
  const tiers = sortedTiers(option.distanceTiers, 'maxDistanceKm');
  if (tiers.length === 0) return true;
  return distanceKm <= tiers[tiers.length - 1].maxDistanceKm;
}

function resolveDistanceTierFee(option: DistanceTierOptionLike, distanceKm: number | null): number {
  const fallback = option.localFallbackFee ?? option.fee ?? 0;
  if (distanceKm == null) return fallback;
  const tiers = sortedTiers(option.distanceTiers, 'maxDistanceKm');
  const match = tiers.find((t) => distanceKm <= t.maxDistanceKm);
  return match ? match.fee : fallback;
}

interface WeightTierOptionLike {
  calculationType?: string;
  weightTiers?: { id: string; maxWeightKg: number; fee: number }[];
  fee: number;
}

// Above the heaviest configured tier, the option is NOT hidden — it simply
// charges that top tier's fee (merchant's own confirmed choice: a big order
// still ships, just possibly under-priced for the outlier case, rather than
// leaving the buyer with no manual national option at all).
function resolveWeightTierFee(option: WeightTierOptionLike, totalWeightKg: number): number {
  const tiers = sortedTiers(option.weightTiers, 'maxWeightKg');
  if (tiers.length === 0) return option.fee ?? 0;
  const match = tiers.find((t) => totalWeightKg <= t.maxWeightKg);
  return match ? match.fee : tiers[tiers.length - 1].fee;
}

interface DeliveryFeeOptionLike extends DistanceTierOptionLike, WeightTierOptionLike {
  freeAbove?: number | null;
  quoteOnRequest?: boolean;
}

interface DeliveryFeeContext {
  subtotalAfterDiscount: number;
  // Only read for calculationType === 'distance_tier'.
  distanceKm?: number | null;
  // Only read for calculationType === 'weight_tier'.
  totalWeightKg?: number;
}

// Single shared fee formula for every calculation mode — replaces the
// flat/freeAbove arithmetic that used to be copy-pasted between
// CartModal.tsx and CheckoutAddressPage.tsx, now extended with the two new
// tiered modes so both checkout flows can't drift apart on pricing either.
export function computeDeliveryFee(option: DeliveryFeeOptionLike | null | undefined, ctx: DeliveryFeeContext): number {
  if (!option) return 0;
  if (option.quoteOnRequest) return 0;
  if (option.calculationType === 'distance_tier') {
    return resolveDistanceTierFee(option, ctx.distanceKm ?? null);
  }
  if (option.calculationType === 'weight_tier') {
    return resolveWeightTierFee(option, ctx.totalWeightKg ?? 0);
  }
  if (option.freeAbove && ctx.subtotalAfterDiscount >= option.freeAbove) return 0;
  return option.fee;
}
