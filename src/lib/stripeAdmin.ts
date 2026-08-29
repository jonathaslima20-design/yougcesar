import { supabase } from './supabase';

const ADMIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-admin`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callStripeAdmin(action: string, payload?: any) {
  const headers = await getAuthHeaders();
  const resp = await fetch(ADMIN_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Falha no processamento');
  return data;
}

export function getStripeAdminConfig() {
  return callStripeAdmin('getConfig');
}

export function saveStripeAdminConfig(payload: any) {
  return callStripeAdmin('saveConfig', payload);
}

export function testStripeAdminCredentials(environment: 'test' | 'production') {
  return callStripeAdmin('testCredentials', { environment });
}

export interface StripePriceRow {
  environment: 'test' | 'production';
  currency: 'MXN' | 'CLP' | 'EUR' | 'USD';
  cycle: 'monthly' | 'annual';
  price_id: string;
}

export function saveStripePrices(prices: StripePriceRow[]) {
  return callStripeAdmin('savePrices', { prices });
}
