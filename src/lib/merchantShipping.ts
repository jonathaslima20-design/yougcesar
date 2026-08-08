import { supabase } from './supabase';
import type { ShippingQuote } from '@/types';

const SETTINGS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-shipping-settings`;
const QUOTE_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-shipping-quote`;

// Merchant-side calls (Frete settings tab) authenticate as the logged-in
// merchant, using the merchant's own Supabase client/session.
async function getMerchantAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callShippingSettings(action: string, payload?: unknown) {
  const headers = await getMerchantAuthHeaders();
  const resp = await fetch(SETTINGS_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Falha no processamento');
  return data;
}

export function getShippingCredentialsConfig() {
  return callShippingSettings('getConfig');
}

export function saveShippingCredentialsConfig(payload: {
  environment: string;
  api_token: string;
  origin_zip_code: string;
  is_active: boolean;
}) {
  return callShippingSettings('saveConfig', payload);
}

export function testShippingCredentials(payload?: {
  api_token?: string;
  environment?: string;
  origin_zip_code?: string;
}) {
  return callShippingSettings('testCredentials', payload);
}

export interface QuoteProduct {
  quantity: number;
  weight: number;
  height: number;
  width: number;
  length: number;
}

// Storefront calls: no auth required at all — this must work for anonymous
// WhatsApp-flow buyers who never log in. Quote-fetching is best-effort
// enrichment, never a checkout dependency, so this never throws: any failure
// (network error, non-2xx response) resolves to an empty quote list instead.
export async function getShippingQuote(
  storeOwnerId: string,
  destinationZipCode: string,
  products: QuoteProduct[],
  serviceIds?: string[]
): Promise<{ quotes: ShippingQuote[] }> {
  try {
    const resp = await fetch(QUOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getQuote',
        payload: {
          store_owner_id: storeOwnerId,
          destination_zip_code: destinationZipCode,
          products,
          services: serviceIds?.join(','),
        },
      }),
    });
    const data = await resp.json().catch(() => ({ quotes: [] }));
    if (!resp.ok) return { quotes: [] };
    return { quotes: Array.isArray(data?.quotes) ? data.quotes : [] };
  } catch {
    return { quotes: [] };
  }
}
