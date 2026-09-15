import { supabase } from './supabase';

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-marketplace-admin`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callMarketplaceAdmin(action: string, payload?: unknown) {
  const headers = await getAuthHeaders();
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Falha no processamento');
  return data;
}

export interface MarketplaceConfig {
  client_id: string;
  client_secret: string;
  environment: 'test' | 'production';
  webhook_secret: string;
  fee_percentage: number;
}

export interface MarketplaceConfigResult {
  config: MarketplaceConfig | null;
  redirect_uri: string;
  notification_url: string;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  account?: { id: number | string; email?: string; nickname?: string };
}

export function getMarketplaceConfig(): Promise<MarketplaceConfigResult> {
  return callMarketplaceAdmin('getConfig');
}

export function saveMarketplaceConfig(payload: MarketplaceConfig) {
  return callMarketplaceAdmin('saveConfig', payload);
}

export function testMarketplaceConnection(): Promise<TestConnectionResult> {
  return callMarketplaceAdmin('testConnection');
}
