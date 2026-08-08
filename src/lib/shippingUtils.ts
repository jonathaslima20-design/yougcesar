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
}

export async function fetchProductShippingDims(
  productIds: string[]
): Promise<Map<string, ProductShippingDims>> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase
    .from('products')
    .select('id, weight_kg, height_cm, width_cm, length_cm')
    .in('id', uniqueIds);

  return new Map((data || []).map((p) => [p.id, p]));
}

function resolveDims(dims?: Partial<ProductShippingDims> | null): QuoteProduct {
  return {
    quantity: 1,
    weight: dims?.weight_kg && dims.weight_kg > 0 ? dims.weight_kg : FALLBACK_DIMENSIONS.weight,
    height: dims?.height_cm && dims.height_cm > 0 ? dims.height_cm : FALLBACK_DIMENSIONS.height,
    width: dims?.width_cm && dims.width_cm > 0 ? dims.width_cm : FALLBACK_DIMENSIONS.width,
    length: dims?.length_cm && dims.length_cm > 0 ? dims.length_cm : FALLBACK_DIMENSIONS.length,
  };
}

export function buildSuperFreteProducts(
  cartItems: CartItem[],
  distributions: CartDistribution[],
  dimsById: Map<string, ProductShippingDims>
): QuoteProduct[] {
  const items: QuoteProduct[] = cartItems.map((item) => ({
    ...resolveDims(dimsById.get(item.id)),
    quantity: Math.max(1, item.quantity),
  }));

  const distributionItems: QuoteProduct[] = distributions.map((dist) => ({
    ...resolveDims({
      weight_kg: dist.product.weight_kg,
      height_cm: dist.product.height_cm,
      width_cm: dist.product.width_cm,
      length_cm: dist.product.length_cm,
    }),
    quantity: Math.max(1, dist.distribution.total_quantity),
  }));

  return [...items, ...distributionItems];
}

export function formatQuoteLabel(quote: ShippingQuote): string {
  const days = quote.deliveryTimeDays
    ? ` — ${quote.deliveryTimeDays} ${quote.deliveryTimeDays === 1 ? 'dia' : 'dias'}`
    : '';
  return `${quote.name} (SuperFrete)${days}`;
}
