import { supabase } from '@/lib/supabase';
import type { StockMovement, StockMovementType, StockReferenceType } from '@/types';
import { pushOlistStockAdjustment } from '@/lib/merchantErp';

interface RecordMovementParams {
  product_id: string;
  variant_stock_id?: string | null;
  movement_type: StockMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type?: StockReferenceType | null;
  reference_id?: string | null;
  reason?: string | null;
  performed_by?: string | null;
}

export async function recordStockMovement(params: RecordMovementParams): Promise<boolean> {
  const { error } = await supabase.from('stock_movements').insert({
    product_id: params.product_id,
    variant_stock_id: params.variant_stock_id || null,
    movement_type: params.movement_type,
    quantity: params.quantity,
    previous_quantity: params.previous_quantity,
    new_quantity: params.new_quantity,
    reference_type: params.reference_type || null,
    reference_id: params.reference_id || null,
    reason: params.reason || null,
    performed_by: params.performed_by || null,
  });

  if (error) {
    console.error('Error recording stock movement:', error);
    return false;
  }
  return true;
}

interface FetchMovementsFilters {
  product_id?: string;
  movement_type?: StockMovementType;
  date_from?: string;
  date_to?: string;
}

export async function fetchStockMovements(
  userId: string,
  limit = 50,
  offset = 0,
  filters?: FetchMovementsFilters
): Promise<{ data: StockMovement[]; count: number }> {
  let query = supabase
    .from('stock_movements')
    .select(
      '*, product:products!inner(title, featured_image_url, user_id), variant_stock:product_variant_stock(color, size, flavor)',
      { count: 'exact' }
    )
    .eq('product.user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.product_id) {
    query = query.eq('product_id', filters.product_id);
  }
  if (filters?.movement_type) {
    query = query.eq('movement_type', filters.movement_type);
  }
  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching stock movements:', error);
    return { data: [], count: 0 };
  }

  return { data: (data || []) as StockMovement[], count: count || 0 };
}

export async function registerStockEntry(
  productId: string,
  quantity: number,
  reason: string,
  performedBy: string,
  variantStockId?: string | null
): Promise<boolean> {
  if (variantStockId) {
    const { data: variant, error: fetchErr } = await supabase
      .from('product_variant_stock')
      .select('quantity')
      .eq('id', variantStockId)
      .maybeSingle();

    if (fetchErr || !variant) return false;

    const prevQty = variant.quantity;
    const newQty = prevQty + quantity;

    const { error: updateErr } = await supabase
      .from('product_variant_stock')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', variantStockId);

    if (updateErr) return false;

    await recordStockMovement({
      product_id: productId,
      variant_stock_id: variantStockId,
      movement_type: 'entrada',
      quantity,
      previous_quantity: prevQty,
      new_quantity: newQty,
      reference_type: 'manual',
      reason,
      performed_by: performedBy,
    });

    await pushOlistStockAdjustment({ product_id: productId, variant_stock_id: variantStockId, delta: quantity });

    await syncProductAggregateStock(productId);
    return true;
  }

  const { data: product, error: fetchErr } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .maybeSingle();

  if (fetchErr || !product) return false;

  const prevQty = product.stock_quantity ?? 0;
  const newQty = prevQty + quantity;

  const { error: updateErr } = await supabase
    .from('products')
    .update({ stock_quantity: newQty })
    .eq('id', productId);

  if (updateErr) return false;

  await recordStockMovement({
    product_id: productId,
    movement_type: 'entrada',
    quantity,
    previous_quantity: prevQty,
    new_quantity: newQty,
    reference_type: 'manual',
    reason,
    performed_by: performedBy,
  });

  await pushOlistStockAdjustment({ product_id: productId, delta: quantity });

  return true;
}

/**
 * Recalcula products.stock_quantity a partir das variantes.
 *
 * Delega para a RPC `recalc_my_product_aggregate_stock` em vez de somar aqui:
 * a soma client-side incluia variantes ORFAS (cor/tamanho que o lojista
 * removeu da oferta mas cuja linha de estoque continua no banco), inflando o
 * agregado e desfazendo a baixa que a venda tinha acabado de fazer. A funcao
 * no banco soma apenas as combinacoes que o produto realmente oferece hoje.
 *
 * Produtos sem grade de variantes nao sao tocados pela RPC — neles o estoque
 * e digitado manualmente no proprio agregado.
 */
export async function syncProductAggregateStock(productId: string): Promise<boolean> {
  const { error } = await supabase.rpc('recalc_my_product_aggregate_stock', {
    p_product_id: productId,
  });

  if (error) {
    console.error('Error recalculating aggregate stock:', error);
    return false;
  }

  return true;
}
