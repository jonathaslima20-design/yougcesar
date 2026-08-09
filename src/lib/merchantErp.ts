import { supabase } from './supabase';

const SETTINGS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-erp-settings`;
const SYNC_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-erp-sync`;
const ORDER_SYNC_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-erp-order-sync`;

async function getMerchantAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callErpEndpoint(endpoint: string, action: string, payload?: unknown) {
  const headers = await getMerchantAuthHeaders();
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Falha no processamento');
  return data;
}

export interface ErpConfig {
  id: string;
  client_id: string;
  client_secret: string;
  connected: boolean;
  is_active: boolean;
  last_synced_at: string | null;
}

export function getErpConfig(): Promise<{ config: ErpConfig | null; redirect_uri: string }> {
  return callErpEndpoint(SETTINGS_ENDPOINT, 'getConfig');
}

export function saveErpClientCredentials(payload: { client_id: string; client_secret: string }) {
  return callErpEndpoint(SETTINGS_ENDPOINT, 'saveClientCredentials', payload);
}

export function getErpAuthorizeUrl(): Promise<{ authorize_url: string }> {
  return callErpEndpoint(SETTINGS_ENDPOINT, 'getAuthorizeUrl');
}

export function exchangeErpCode(payload: { code: string; state: string }) {
  return callErpEndpoint(SETTINGS_ENDPOINT, 'exchangeCode', payload);
}

export function disconnectErp() {
  return callErpEndpoint(SETTINGS_ENDPOINT, 'disconnect');
}

export interface ErpProduct {
  olist_product_id: string;
  sku: string;
  name: string;
  situacao: string;
  price: number | null;
  // True when this is a "produto pai" grouping cor/tamanho variations in the
  // Olist — importing it brings every combination into ONE product here,
  // each with its own stock and its own olist_product_id link.
  has_variations: boolean;
}

export function listErpProducts(payload?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ products: ErpProduct[]; pagination: { limit: number; offset: number; total: number } }> {
  return callErpEndpoint(SYNC_ENDPOINT, 'listErpProducts', payload);
}

export function linkErpProduct(payload: { product_id: string; olist_product_id: string; variant_stock_id?: string }) {
  return callErpEndpoint(SYNC_ENDPOINT, 'linkProduct', payload);
}

export function unlinkErpProduct(payload: { product_id: string; variant_stock_id?: string }) {
  return callErpEndpoint(SYNC_ENDPOINT, 'unlinkProduct', payload);
}

export function pushErpPrice(payload: { product_id: string }) {
  return callErpEndpoint(SYNC_ENDPOINT, 'pushPrice', payload);
}

export function pullErpProduct(payload: { olist_product_id: string; product_id?: string }): Promise<{
  success: boolean;
  product_id: string;
  variant_count?: number;
}> {
  return callErpEndpoint(SYNC_ENDPOINT, 'pullProduct', payload);
}

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors: Array<{ olist_product_id: string; error: string }>;
}

export function bulkImportErpProducts(payload: { olist_product_ids: string[] }): Promise<BulkImportResult> {
  return callErpEndpoint(SYNC_ENDPOINT, 'bulkImportProducts', payload);
}

export interface PullStockResult {
  synced: number;
  failed: number;
  errors: Array<{ product_id: string; error: string }>;
  has_more: boolean;
}

export function pullErpStock(): Promise<PullStockResult> {
  return callErpEndpoint(SYNC_ENDPOINT, 'pullStock');
}

// Called from the storefront checkout flow (buyer session, no merchant JWT
// available) right after an order's stock is deducted locally — so, unlike
// every other call in this file, this one is unauthenticated and scoped only
// by store_owner_id, same as getShippingQuote. It must never throw: a store
// that isn't connected to Olist (the common case) or any network hiccup
// should never surface as a checkout error.
export async function pushOlistStockDeduction(payload: {
  store_owner_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price?: number;
    selected_color?: string | null;
    selected_size?: string | null;
    selected_flavor?: string | null;
  }>;
}): Promise<void> {
  try {
    await fetch(ORDER_SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pushStockDeduction', payload }),
    });
  } catch {
    // best-effort — see comment above
  }
}

// Called from the merchant's own dashboard right after a manual stock edit
// (variant grid, quick popover, restock dialog) — authenticated, unlike
// pushOlistStockDeduction above. Mirrors its "never throw" contract: editing
// stock in VitrineTurbo must always succeed even if Olist is unreachable, not
// connected, or this product/variant isn't linked (the endpoint no-ops in
// all of those cases rather than erroring).
export async function pushOlistStockAdjustment(payload: {
  product_id: string;
  variant_stock_id?: string | null;
  delta: number;
}): Promise<void> {
  try {
    await callErpEndpoint(SYNC_ENDPOINT, 'pushStockAdjustment', payload);
  } catch {
    // best-effort — see comment above
  }
}
