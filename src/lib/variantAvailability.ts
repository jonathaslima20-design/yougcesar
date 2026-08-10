export interface VariantStockInfo {
  id: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  weight_variant_id: string | null;
  quantity: number;
  reserved_quantity: number;
  available: number;
}

interface VariantAvailabilityProduct {
  colors?: string[] | null;
  sizes?: string[] | null;
  flavors?: string[] | null;
  track_inventory?: boolean;
}

// Shared by ProductVariantModal and the inline storefront selector so both
// read stock the same way. Returns null when availability isn't knowable yet
// (inventory tracking off, or the combination isn't fully selected) so the UI
// can distinguish "unknown" from "confirmed zero" — a product that tracks
// stock but never stocked this exact combination is a confirmed zero, not
// unknown, hence the `variantStockData.length === 1` fallback below only
// applies to genuinely variant-less products.
export function getVariantAvailable(
  product: VariantAvailabilityProduct,
  variantStockData: VariantStockInfo[],
  inventoryEnabled: boolean,
  color?: string,
  size?: string,
  flavor?: string
): number | null {
  if (!inventoryEnabled || !product.track_inventory || variantStockData.length === 0) return null;

  if (product.colors && product.colors.length > 0 && !color) return null;
  if (product.sizes && product.sizes.length > 0 && !size) return null;
  if (product.flavors && product.flavors.length > 0 && !flavor) return null;

  const match = variantStockData.find(
    (v) =>
      (v.color || null) === (color || null) &&
      (v.size || null) === (size || null) &&
      (v.flavor || null) === (flavor || null)
  );
  if (match) return match.available;
  if (variantStockData.length === 1 && !variantStockData[0].color && !variantStockData[0].size && !variantStockData[0].flavor) {
    return variantStockData[0].available;
  }
  return 0;
}
