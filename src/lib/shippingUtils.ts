import { supabase } from './supabase';
import type { CartItem, CartDistribution, ShippingQuote } from '@/types';
import type { QuoteProduct } from './merchantShipping';

// Small-parcel default applied whenever a product is missing one or more
// shipping dimensions — lets a quote still be attempted instead of failing
// outright. Not a merchant-configurable setting in this pass.
const FALLBACK_DIMENSIONS = { weight: 0.3, height: 2, width: 11, length: 16 };

interface ProductShippingDims {
  weight_kg: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  package_type?: 'envelope' | 'box' | 'cylinder' | null;
  diameter_cm?: number | null;
}

export async function fetchProductShippingDims(
  productIds: string[]
): Promise<Map<string, ProductShippingDims>> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase
    .from('products')
    .select('id, weight_kg, height_cm, width_cm, length_cm, package_type, diameter_cm')
    .in('id', uniqueIds);

  return new Map((data || []).map((p) => [p.id, p]));
}

// Weight variants (e.g. a coffee bag sold as 250g/500g/1kg) can genuinely
// weigh different amounts in real life, but only carry a real shipping
// weight when the merchant fills one in — most don't, so a missing/zero
// value here means "use the product's own weight_kg", not "0kg".
export async function fetchVariantShippingWeights(
  variantIds: string[]
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(variantIds)].filter(Boolean);
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase
    .from('product_weight_variants')
    .select('id, shipping_weight_kg')
    .in('id', uniqueIds);

  const map = new Map<string, number>();
  for (const row of data || []) {
    if (row.shipping_weight_kg && row.shipping_weight_kg > 0) {
      map.set(row.id, row.shipping_weight_kg);
    }
  }
  return map;
}

function resolveDims(dims?: Partial<ProductShippingDims> | null): QuoteProduct {
  // A cylinder package (envelope/box forms don't set this) has no real
  // height/width of its own — the packaging form only collects weight,
  // length, and diameter for it (see packaging-fields.tsx). Its shipping
  // bounding box is the tube lying flat: diameter × diameter × length.
  const isCylinder = dims?.package_type === 'cylinder' && dims?.diameter_cm && dims.diameter_cm > 0;
  const heightCm = isCylinder ? dims!.diameter_cm! : dims?.height_cm;
  const widthCm = isCylinder ? dims!.diameter_cm! : dims?.width_cm;

  return {
    quantity: 1,
    weight: dims?.weight_kg && dims.weight_kg > 0 ? dims.weight_kg : FALLBACK_DIMENSIONS.weight,
    height: heightCm && heightCm > 0 ? heightCm : FALLBACK_DIMENSIONS.height,
    width: widthCm && widthCm > 0 ? widthCm : FALLBACK_DIMENSIONS.width,
    length: dims?.length_cm && dims.length_cm > 0 ? dims.length_cm : FALLBACK_DIMENSIONS.length,
  };
}

export function buildSuperFreteProducts(
  cartItems: CartItem[],
  distributions: CartDistribution[],
  dimsById: Map<string, ProductShippingDims>,
  variantWeightsById?: Map<string, number>
): QuoteProduct[] {
  const items: QuoteProduct[] = cartItems.map((item) => {
    const resolved = resolveDims(dimsById.get(item.id));
    // Dimensions (height/width/length) still come from the product, since
    // weight variants don't have their own — only the weight can override,
    // and only when the merchant actually set one for this variant.
    const variantWeight = item.selectedVariantId
      ? variantWeightsById?.get(item.selectedVariantId)
      : undefined;
    return {
      ...resolved,
      weight: variantWeight ?? resolved.weight,
      quantity: Math.max(1, item.quantity),
    };
  });

  const distributionItems: QuoteProduct[] = distributions.map((dist) => ({
    ...resolveDims({
      weight_kg: dist.product.weight_kg,
      height_cm: dist.product.height_cm,
      width_cm: dist.product.width_cm,
      length_cm: dist.product.length_cm,
      package_type: dist.product.package_type,
      diameter_cm: dist.product.diameter_cm,
    }),
    quantity: Math.max(1, dist.distribution.total_quantity),
  }));

  return [...items, ...distributionItems];
}

export function formatQuoteLabel(quote: ShippingQuote): string {
  const days = quote.deliveryTimeDays
    ? ` — ${quote.deliveryTimeDays} ${quote.deliveryTimeDays === 1 ? 'dia' : 'dias'}`
    : '';
  return `${quote.name}${days}`;
}
