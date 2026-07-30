import { supabaseBuyer } from './supabaseBuyer';
import type { Product } from '@/types';

export interface ReorderItemInput {
  product_id: string;
  product_title: string;
  quantity: number;
  selected_color: string | null;
  selected_size: string | null;
  selected_flavor: string | null;
  selected_variant_label: string | null;
}

export interface ReorderResult {
  addedCount: number;
  skipped: string[];
}

type AddToCartFn = (
  product: Product,
  selectedColor?: string,
  selectedSize?: string,
  quantity?: number,
  appliedTierPrice?: number,
  selectedFlavor?: string
) => void;

export async function reorderItems(
  items: ReorderItemInput[],
  addToCart: AddToCartFn
): Promise<ReorderResult> {
  const skipped: string[] = [];

  // Weight-variant items don't record which variant was bought (only its
  // label), so there's no safe way to re-add them at the right price —
  // skip with a warning instead of guessing.
  const weightVariantItems = items.filter((i) => i.selected_variant_label);
  const regularItems = items.filter((i) => !i.selected_variant_label);
  weightVariantItems.forEach((i) => skipped.push(i.product_title));

  if (regularItems.length === 0) {
    return { addedCount: 0, skipped };
  }

  const productIds = [...new Set(regularItems.map((i) => i.product_id))];
  const { data: products } = await supabaseBuyer
    .from('products')
    .select('*, product_images(*)')
    .in('id', productIds);

  const productMap = new Map((products || []).map((p) => [p.id, p as Product]));

  let addedCount = 0;
  for (const item of regularItems) {
    const product = productMap.get(item.product_id);
    if (!product || product.status !== 'disponivel' || product.is_visible_on_storefront === false) {
      skipped.push(item.product_title);
      continue;
    }

    addToCart(
      product,
      item.selected_color || undefined,
      item.selected_size || undefined,
      item.quantity,
      undefined,
      item.selected_flavor || undefined
    );
    addedCount++;
  }

  return { addedCount, skipped };
}
