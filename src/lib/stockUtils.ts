import { supabase } from '@/lib/supabase';
import type { Product, ProductVariantStock } from '@/types';
import { recordStockMovement, syncProductAggregateStock } from '@/lib/stockMovementService';
import { pushOlistStockAdjustment } from '@/lib/merchantErp';

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

export interface StockShortfallItem {
  product_id: string;
  product_title: string;
  variant_stock_id?: string | null;
  selected_color?: string | null;
  selected_size?: string | null;
  selected_flavor?: string | null;
  requested: number;
  deducted?: number;
  /** null/undefined = a combinacao nao existe na grade de variantes. */
  available?: number | null;
}

interface DeductionResult {
  success: boolean;
  /** Quantos itens tiveram baixa real. 0 = nada saiu do estoque. */
  deductedCount: number;
  /** Itens sem saldo suficiente — a baixa foi parcial ou nula. */
  insufficientItems: StockShortfallItem[];
  /** Itens cuja cor/tamanho nao existe na grade de variantes do produto. */
  unmatchedItems: StockShortfallItem[];
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
  const { data, error } = await supabase.rpc('deduct_stock_for_order', {
    p_order_id: orderId,
    p_store_owner_id: storeOwnerId,
    p_items: items,
  });

  if (error) {
    console.error('Error deducting stock for order:', error);
    return { success: false, deductedCount: 0, insufficientItems: [], unmatchedItems: [], notifications: [] };
  }

  // A RPC ja persiste o mesmo conteudo em orders.stock_shortfall, entao o
  // pedido fica sinalizado no painel mesmo que este retorno se perca (aba
  // fechada no meio do checkout, por exemplo).
  return {
    success: true,
    deductedCount: data?.deducted_count ?? 0,
    insufficientItems: (data?.insufficient_items ?? []) as StockShortfallItem[],
    unmatchedItems: (data?.unmatched_items ?? []) as StockShortfallItem[],
    notifications: [],
  };
}

/**
 * Estorna ao estoque o que um pedido cancelado tinha baixado.
 *
 * Delega para a RPC `restore_stock_for_order`, que usa os `stock_movements`
 * de saida do pedido como fonte da verdade. A versao anterior devolvia a
 * quantidade PEDIDA: como a baixa e limitada ao saldo disponivel, um pedido
 * de 5 unidades com 3 em estoque baixava 3 e o cancelamento devolvia 5,
 * inventando 2 unidades. A RPC tambem e idempotente e trava as linhas, entao
 * dois cancelamentos do mesmo pedido nao duplicam a devolucao.
 */
export async function restoreStockForOrder(orderId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('restore_stock_for_order', {
    p_order_id: orderId,
  });

  if (error || !data?.success) {
    console.error('Error restoring stock for order:', error || data?.error);
    return false;
  }

  return true;
}

export class VariantManagedStockError extends Error {
  constructor() {
    super('Este produto tem estoque por variante. Edite pela grade de variantes.');
    this.name = 'VariantManagedStockError';
  }
}

/**
 * Ajuste manual do estoque agregado de um produto.
 *
 * Recusa produtos que tem grade de variantes: neles `products.stock_quantity`
 * e um valor DERIVADO da soma das variantes ofertadas, entao um numero
 * digitado aqui era silenciosamente descartado no recalculo da venda seguinte.
 * O lojista via o estoque "voltar sozinho" sem entender por que.
 */
export async function updateProductStock(
  productId: string,
  newQuantity: number,
  performedBy?: string
): Promise<boolean> {
  const { count: variantCount } = await supabase
    .from('product_variant_stock')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  if ((variantCount ?? 0) > 0) {
    throw new VariantManagedStockError();
  }

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

  await pushOlistStockAdjustment({ product_id: productId, delta: newQuantity - prevQty });

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

      await pushOlistStockAdjustment({ product_id: productId, variant_stock_id: existing.id, delta: quantity - prevQty });
    }
  } else {
    const { data: created, error } = await supabase
      .from('product_variant_stock')
      .insert({
        product_id: productId,
        color: color || null,
        size: size || null,
        flavor: flavor || null,
        quantity,
        reserved_quantity: 0,
      })
      .select('id')
      .single();

    if (error) return false;

    if (quantity !== 0) {
      await pushOlistStockAdjustment({ product_id: productId, variant_stock_id: created.id, delta: quantity });
    }
  }

  await syncProductAggregateStock(productId);
  return true;
}
