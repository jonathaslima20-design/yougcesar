import { supabaseBuyer } from './supabaseBuyer';
import type { CartItem } from '@/types';

function rowToCartItem(row: any): CartItem {
  return {
    id: row.product_id,
    variantId: row.variant_id,
    title: row.title,
    price: row.price,
    discounted_price: row.discounted_price ?? undefined,
    quantity: row.quantity,
    featured_image_url: row.featured_image_url ?? undefined,
    short_description: row.short_description ?? undefined,
    is_starting_price: row.is_starting_price ?? undefined,
    notes: row.notes ?? '',
    selectedColor: row.selected_color ?? undefined,
    selectedSize: row.selected_size ?? undefined,
    selectedFlavor: row.selected_flavor ?? undefined,
    availableColors: row.available_colors ?? undefined,
    availableSizes: row.available_sizes ?? undefined,
    availableFlavors: row.available_flavors ?? undefined,
    has_tiered_pricing: row.has_tiered_pricing ?? undefined,
    applied_tier_price: row.applied_tier_price ?? undefined,
    selectedVariantId: row.selected_variant_id ?? undefined,
    selectedVariantLabel: row.selected_variant_label ?? undefined,
    variantPrice: row.variant_price ?? undefined,
  };
}

function cartItemToRow(customerId: string, item: CartItem) {
  return {
    customer_id: customerId,
    product_id: item.id,
    variant_id: item.variantId || item.id,
    title: item.title,
    price: item.price,
    discounted_price: item.discounted_price ?? null,
    quantity: item.quantity,
    featured_image_url: item.featured_image_url ?? null,
    short_description: item.short_description ?? null,
    is_starting_price: item.is_starting_price ?? null,
    notes: item.notes ?? null,
    selected_color: item.selectedColor ?? null,
    selected_size: item.selectedSize ?? null,
    selected_flavor: item.selectedFlavor ?? null,
    available_colors: item.availableColors ?? null,
    available_sizes: item.availableSizes ?? null,
    available_flavors: item.availableFlavors ?? null,
    has_tiered_pricing: item.has_tiered_pricing ?? null,
    applied_tier_price: item.applied_tier_price ?? null,
    selected_variant_id: item.selectedVariantId ?? null,
    selected_variant_label: item.selectedVariantLabel ?? null,
    variant_price: item.variantPrice ?? null,
    updated_at: new Date().toISOString(),
  };
}

// Table not migrated yet on this environment — treat as "no server cart" instead of throwing.
const TABLE_MISSING = '42P01';

export async function fetchBuyerCart(customerId: string): Promise<CartItem[]> {
  const { data, error } = await supabaseBuyer
    .from('buyer_cart_items')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === TABLE_MISSING) return [];
    throw error;
  }
  return (data || []).map(rowToCartItem);
}

// Full replace keeps this simple and correct: the client cart is small
// (a handful of line items) and is already the merged/desired state by the
// time this is called, so diffing inserts/updates/deletes buys nothing.
export async function replaceBuyerCart(customerId: string, items: CartItem[]): Promise<void> {
  const { error: deleteError } = await supabaseBuyer
    .from('buyer_cart_items')
    .delete()
    .eq('customer_id', customerId);

  if (deleteError) {
    if (deleteError.code === TABLE_MISSING) return;
    throw deleteError;
  }

  if (items.length === 0) return;

  const { error: insertError } = await supabaseBuyer
    .from('buyer_cart_items')
    .insert(items.map((item) => cartItemToRow(customerId, item)));

  if (insertError && insertError.code !== TABLE_MISSING) throw insertError;
}

// Merge a guest (local-only) cart into the buyer's server cart on login:
// matching variants sum quantities, everything else is unioned.
export function mergeCartItems(localItems: CartItem[], serverItems: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  for (const item of serverItems) {
    merged.set(item.variantId || item.id, item);
  }

  for (const item of localItems) {
    const key = item.variantId || item.id;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, quantity: existing.quantity + item.quantity } : item);
  }

  return Array.from(merged.values());
}
