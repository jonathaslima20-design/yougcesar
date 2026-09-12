import { supabase } from './supabase';

const ADMIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cakto-admin`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callCaktoAdmin(action: string, payload?: any) {
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

export function getCaktoAdminConfig() {
  return callCaktoAdmin('getConfig');
}

export function saveCaktoAdminConfig(payload: any) {
  return callCaktoAdmin('saveConfig', payload);
}

export function testCaktoAdminCredentials(environment: 'test' | 'production') {
  return callCaktoAdmin('testCredentials', { environment });
}

export interface CaktoOfferRow {
  environment: 'test' | 'production';
  plan_id: string;
  billing_cycle: string;
  product_id: string;
  offer_id: string;
}

export function saveCaktoOffers(offers: CaktoOfferRow[]) {
  return callCaktoAdmin('saveOffers', { offers });
}

export function deleteCaktoOffer(id: string) {
  return callCaktoAdmin('deleteOffer', { id });
}
