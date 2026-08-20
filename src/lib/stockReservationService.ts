import { supabase } from '@/lib/supabase';
import type { StockReservation } from '@/types';

const SESSION_KEY = 'vitrineturbo_cart_session';

export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export async function createReservation(
  productId: string,
  quantity: number,
  reservationMinutes: number,
  variantStockId?: string | null
): Promise<StockReservation | null> {
  const sessionId = getOrCreateSessionId();
  const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('stock_reservations')
    .insert({
      product_id: productId,
      variant_stock_id: variantStockId || null,
      session_id: sessionId,
      quantity,
      expires_at: expiresAt,
      status: 'active',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating reservation:', error);
    return null;
  }

  if (data && variantStockId) {
    await supabase.rpc('increment_reserved_quantity', {
      p_variant_stock_id: variantStockId,
      p_amount: quantity,
    }).then(({ error: rpcError }) => {
      if (rpcError) {
        supabase
          .from('product_variant_stock')
          .update({ reserved_quantity: quantity })
          .eq('id', variantStockId);
      }
    });
  }

  return data as StockReservation;
}

export async function releaseReservation(reservationId: string): Promise<boolean> {
  const { data: reservation, error: fetchErr } = await supabase
    .from('stock_reservations')
    .select('*')
    .eq('id', reservationId)
    .eq('status', 'active')
    .maybeSingle();

  if (fetchErr || !reservation) return false;

  const { error } = await supabase
    .from('stock_reservations')
    .update({ status: 'expired' })
    .eq('id', reservationId);

  if (error) return false;

  if (reservation.variant_stock_id) {
    const { data: variant } = await supabase
      .from('product_variant_stock')
      .select('reserved_quantity')
      .eq('id', reservation.variant_stock_id)
      .maybeSingle();

    if (variant) {
      const newReserved = Math.max(0, variant.reserved_quantity - reservation.quantity);
      await supabase
        .from('product_variant_stock')
        .update({ reserved_quantity: newReserved })
        .eq('id', reservation.variant_stock_id);
    }
  }

  return true;
}

export async function convertReservation(reservationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('stock_reservations')
    .update({ status: 'converted' })
    .eq('id', reservationId)
    .eq('status', 'active');

  return !error;
}

export async function releaseSessionReservations(): Promise<void> {
  const sessionId = getOrCreateSessionId();

  const { data: reservations } = await supabase
    .from('stock_reservations')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'active');

  if (reservations) {
    for (const r of reservations) {
      await releaseReservation(r.id);
    }
  }
}

export async function getActiveReservationsForSession(): Promise<StockReservation[]> {
  const sessionId = getOrCreateSessionId();

  const { data, error } = await supabase
    .from('stock_reservations')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  if (error) return [];
  return (data || []) as StockReservation[];
}

export async function getAvailableVariantStock(
  productId: string
): Promise<Array<{ id: string; color: string | null; size: string | null; flavor: string | null; weight_variant_id: string | null; quantity: number; reserved_quantity: number; available: number }>> {
  const { data, error } = await supabase
    .from('product_variant_stock')
    .select('*')
    .eq('product_id', productId);

  if (error || !data) return [];

  return data.map((v) => ({
    ...v,
    available: Math.max(0, v.quantity - v.reserved_quantity),
  }));
}

/**
 * For catalog-level size filtering: which sizes actually have stock available
 * (summed across colors/flavors) for each of the given products. Mirrors the
 * per-product `getSizeAvailable` sum used on the product detail page, just
 * batched across products with a single `.in()` query.
 *
 * A product only appears as a key when it has at least one variant-stock row
 * (i.e. it actually participates in the color/size grid) — even if every row
 * nets to zero, it still gets an entry (possibly an empty set). Products with
 * `track_inventory` on but no variant rows at all (simple flat-quantity
 * tracking, no size grid) are absent from the map entirely, so callers can
 * tell "confirmed zero for this size" apart from "no size-level stock data
 * exists" and fall back to the declared `sizes` list for those — same
 * unknown-vs-zero distinction `getVariantAvailable` already makes.
 */
export async function getAvailableSizesByProduct(
  productIds: string[]
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (productIds.length === 0) return result;

  const { data, error } = await supabase
    .from('product_variant_stock')
    .select('product_id, size, quantity, reserved_quantity')
    .in('product_id', productIds);

  if (error || !data) return result;

  const availableByProductSize = new Map<string, number>();
  for (const row of data) {
    if (!result.has(row.product_id)) result.set(row.product_id, new Set());
    if (!row.size) continue;
    const key = `${row.product_id}::${row.size}`;
    const available = Math.max(0, row.quantity - row.reserved_quantity);
    availableByProductSize.set(key, (availableByProductSize.get(key) || 0) + available);
  }

  for (const [key, total] of availableByProductSize) {
    if (total <= 0) continue;
    const [productId, size] = key.split('::');
    result.get(productId)!.add(size);
  }

  return result;
}

export async function cleanExpiredReservations(): Promise<number> {
  const { data: expired } = await supabase
    .from('stock_reservations')
    .select('id, variant_stock_id, quantity')
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());

  if (!expired || expired.length === 0) return 0;

  for (const r of expired) {
    await releaseReservation(r.id);
  }

  return expired.length;
}
