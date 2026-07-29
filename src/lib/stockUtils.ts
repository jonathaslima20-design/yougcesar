import { supabase } from '@/lib/supabase';
import type { Product, ProductVariantStock } from '@/types';
import { recordStockMovement, syncProductAggregateStock } from '@/lib/stockMovementService';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'untracked';

export function getStockStatus(product: Pick<Product, 'track_inventory' | 'stock_quantity' | 'low_stock_threshold'>): StockStatus {
  if (!product.track_inventory || product.stock_quantity == null) {
    return 'untracked';
  }
  if (product.stock_quantity <= 0) {
    return 'out_of_stock';
  }
  if (product.stock_quantity <= (product.low_stock_threshold ?? 5)) {
    return 'low_stock';
  }
  return 'in_stock';
}

export function getVariantStockStatus(
  variant: Pick<ProductVariantStock, 'quantity' | 'reserved_quantity'>,
  lowStockThreshold: number = 5
): StockStatus {
  const available = variant.quantity - variant.reserved_quantity;
  if (available <= 0) return 'out_of_stock';
  if (available <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

interface DeductionItem {
  product_id: string;
  quantity: number;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_flavor?: string | null;
  selected_variant_label?: string | null;
}

interface DeductionResult {
  success: boolean;
  notifications: { productId: string; productTitle: string; type: 'low_stock' | 'out_of_stock' }[];
}

export async function deductStockForOrder(
  orderId: string,
  storeOwnerId: string,
  items: DeductionItem[]
): Promise<DeductionResult> {
  // Runs as a SECURITY DEFINER RPC because this is called from the buyer's
  // session at checkout: product_variant_stock/products/stock_movements are
  // only writable by the product owner via RLS, so a direct client-side
  // write here would silently no-op (or fail) for anyone but the seller.
  const { error } = await supabase.rpc('deduct_stock_for_order', {
    p_order_id: orderId,
    p_store_owner_id: storeOwnerId,
    p_items: items,
  });

  if (error) {
    console.error('Error deducting stock for order:', error);
    return { success: false, notifications: [] };
  }

  return { success: true, notifications: [] };
}

export async function restoreStockForOrder(
  orderId: string,
  items: DeductionItem[]
): Promise<boolean> {
  for (const item of items) {
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, track_inventory, stock_quantity')
      .eq('id', item.product_id)
      .maybeSingle();

    if (fetchError || !product || !product.track_inventory) continue;

    const variantStock = await findVariantStock(item.product_id, item.selected_color, item.selected_size, item.selected_flavor);

    if (variantStock) {
      const prevQty = variantStock.quantity;
      const newQty = prevQty + item.quantity;

      await supabase
        .from('product_variant_stock')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', variantStock.id);

      await recordStockMovement({
        product_id: item.product_id,
        variant_stock_id: variantStock.id,
        movement_type: 'cancelamento',
        quantity: item.quantity,
        previous_quantity: prevQty,
        new_quantity: newQty,
        reference_type: 'order',
        reference_id: orderId,
      });

      await syncProductAggregateStock(item.product_id);
    } else {
      const prevQty = product.stock_quantity ?? 0;
      const newQty = prevQty + item.quantity;

      await supabase
        .from('products')
        .update({ stock_quantity: newQty })
        .eq('id', item.product_id);

      await recordStockMovement({
        product_id: item.product_id,
        movement_type: 'cancelamento',
        quantity: item.quantity,
        previous_quantity: prevQty,
        new_quantity: newQty,
        reference_type: 'order',
        reference_id: orderId,
      });
    }
  }

  await supabase
    .from('orders')
    .update({ inventory_deducted: false })
    .eq('id', orderId);

  return true;
}

export async function updateProductStock(
  productId: string,
  newQuantity: number,
  performedBy?: string
): Promise<boolean> {
  const { data: product } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .maybeSingle();

  const prevQty = product?.stock_quantity ?? 0;

  const { error } = await supabase
    .from('products')
    .update({ stock_quantity: newQuantity })
    .eq('id', productId);

  if (error) return false;

  await recordStockMovement({
    product_id: productId,
    movement_type: 'ajuste',
    quantity: newQuantity - prevQty,
    previous_quantity: prevQty,
    new_quantity: newQuantity,
    reference_type: 'manual',
    performed_by: performedBy || null,
  });

  return true;
}

export async function findVariantStock(
  productId: string,
  color?: string | null,
  size?: string | null,
  flavor?: string | null
): Promise<ProductVariantStock | null> {
  let query = supabase
    .from('product_variant_stock')
    .select('*')
    .eq('product_id', productId);

  if (color) {
    query = query.eq('color', color);
  } else {
    query = query.is('color', null);
  }

  if (size) {
    query = query.eq('size', size);
  } else {
    query = query.is('size', null);
  }

  if (flavor) {
    query = query.eq('flavor', flavor);
  } else {
    query = query.is('flavor', null);
  }

  const { data } = await query.maybeSingle();
  return data as ProductVariantStock | null;
}

export async function fetchVariantStockForProduct(productId: string): Promise<ProductVariantStock[]> {
  const { data, error } = await supabase
    .from('product_variant_stock')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []) as ProductVariantStock[];
}

export async function upsertVariantStock(
  productId: string,
  color: string | null,
  size: string | null,
  flavor: string | null,
  quantity: number,
  performedBy?: string
): Promise<boolean> {
  const existing = await findVariantStock(productId, color, size, flavor);

  if (existing) {
    const prevQty = existing.quantity;
    const { error } = await supabase
      .from('product_variant_stock')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) return false;

    if (prevQty !== quantity) {
      await recordStockMovement({
        product_id: productId,
        variant_stock_id: existing.id,
        movement_type: 'ajuste',
        quantity: quantity - prevQty,
        previous_quantity: prevQty,
        new_quantity: quantity,
        reference_type: 'manual',
        performed_by: performedBy || null,
      });
    }
  } else {
    const { error } = await supabase
      .from('product_variant_stock')
      .insert({
        product_id: productId,
        color: color || null,
        size: size || null,
        flavor: flavor || null,
        quantity,
        reserved_quantity: 0,
      });

    if (error) return false;
  }

  await syncProductAggregateStock(productId);
  return true;
}
