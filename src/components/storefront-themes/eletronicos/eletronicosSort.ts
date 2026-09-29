import type { Product } from '@/types';

export type EletronicosSortKey = 'relevance' | 'price_asc' | 'price_desc' | 'discount';

export const ELETRONICOS_SORT_OPTIONS: { value: EletronicosSortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'discount', label: 'Maior desconto' },
];

// The price a shopper actually sees on the card: tier/weight-variant "from" prices
// first, then the discounted price when it's a real markdown, then the list price.
function displayPrice(product: Product): number {
  if (product.has_tiered_pricing && (product.min_tiered_price ?? 0) > 0) return Number(product.min_tiered_price);
  if (product.has_weight_variants && (product.min_variant_price ?? 0) > 0) return Number(product.min_variant_price);
  const price = product.price ?? 0;
  const discounted = product.discounted_price ?? 0;
  return discounted > 0 && discounted < price ? discounted : price;
}

function discountPercent(product: Product): number {
  const price = product.price ?? 0;
  const discounted = product.discounted_price ?? 0;
  return price > 0 && discounted > 0 && discounted < price ? (price - discounted) / price : 0;
}

/** Returns a sorted copy; "relevance" keeps the store's own order untouched. */
export function sortProducts(products: Product[], sortBy: EletronicosSortKey): Product[] {
  if (sortBy === 'relevance') return products;
  const sorted = [...products];
  if (sortBy === 'discount') {
    return sorted.sort((a, b) => discountPercent(b) - discountPercent(a));
  }
  // Products without a price go to the end in both directions instead of leading the list.
  return sorted.sort((a, b) => {
    const pa = displayPrice(a);
    const pb = displayPrice(b);
    if (pa <= 0 && pb <= 0) return 0;
    if (pa <= 0) return 1;
    if (pb <= 0) return -1;
    return sortBy === 'price_asc' ? pa - pb : pb - pa;
  });
}
