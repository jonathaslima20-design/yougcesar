import { supabase } from '@/lib/supabase';

export interface CartStockCheckItem {
  // Identifies the cart entry this check item came from (a plain item's
  // variantId, or a `dist:<distributionId>:<distributionItemId>` marker for
  // wholesale distribution lines) so a shortfall can be traced back to the
  // exact cart entry to adjust, instead of just reported as a blocking error.
  key: string;
  productId: string;
  title: string;
  quantity: number;
  selectedColor?: string | null;
  selectedSize?: string | null;
  selectedFlavor?: string | null;
}

export interface StockShortfall {
  key: string;
  productId: string;
  title: string;
  variantLabel: string | null;
  requested: number;
  available: number;
}

/**
 * Re-checks current stock for cart items right before an order is placed.
 * Catches the common case of an item selling out while it sat in someone
 * else's cart — this is a UX check, not the source of truth: the atomic
 * guard in the `deduct_stock_for_order` RPC is what actually prevents
 * overselling if two checkouts still race past this.
 */
export async function findCartStockShortfalls(
  items: CartStockCheckItem[]
): Promise<StockShortfall[]> {
  if (items.length === 0) return [];

  const productIds = [...new Set(items.map((i) => i.productId))];

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, track_inventory, stock_quantity')
    .in('id', productIds);

  if (productsError || !products) return [];

  const trackedProducts = products.filter((p) => p.track_inventory);
  if (trackedProducts.length === 0) return [];

  const trackedIds = trackedProducts.map((p) => p.id);
  const productMap = new Map(trackedProducts.map((p) => [p.id, p]));

  const { data: variants } = await supabase
    .from('product_variant_stock')
    .select('product_id, color, size, flavor, quantity, reserved_quantity')
    .in('product_id', trackedIds);

  const shortfalls: StockShortfall[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    const productVariants = (variants || []).filter((v) => v.product_id === item.productId);
    let available: number;

    if (productVariants.length > 0) {
      const match = productVariants.find(
        (v) =>
          (v.color || null) === (item.selectedColor || null) &&
          (v.size || null) === (item.selectedSize || null) &&
          (v.flavor || null) === (item.selectedFlavor || null)
      );
      available = match ? Math.max(0, match.quantity - match.reserved_quantity) : 0;
    } else {
      available = Math.max(0, product.stock_quantity ?? 0);
    }

    if (available < item.quantity) {
      shortfalls.push({
        key: item.key,
        productId: item.productId,
        title: item.title,
        variantLabel:
          [item.selectedColor, item.selectedSize, item.selectedFlavor].filter(Boolean).join(' / ') ||
          null,
        requested: item.quantity,
        available,
      });
    }
  }

  return shortfalls;
}

export function formatShortfallLines(shortfalls: StockShortfall[]): string {
  return shortfalls
    .map((s) => {
      const variant = s.variantLabel ? ` (${s.variantLabel})` : '';
      return s.available > 0
        ? `${s.title}${variant}: restam apenas ${s.available} unidade(s)`
        : `${s.title}${variant}: esgotado`;
    })
    .join('\n');
}

export function formatShortfallMessage(shortfalls: StockShortfall[]): string {
  return `Estoque insuficiente para continuar. Ajuste o carrinho:\n${formatShortfallLines(shortfalls)}`;
}
