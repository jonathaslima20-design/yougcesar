import { supabase } from './supabase';
import { supabaseBuyer } from './supabaseBuyer';

const SETTINGS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-payment-settings`;
const PAYMENTS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-payments`;

// Merchant-side calls (Payment Settings tab) authenticate as the logged-in
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

async function callMerchantPaymentSettings(action: string, payload?: unknown) {
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

export function getMerchantPaymentConfig() {
  return callMerchantPaymentSettings('getConfig');
}

export function saveMerchantPaymentConfig(payload: {
  environment: string;
  public_key: string;
  access_token: string;
  webhook_secret: string;
  is_active: boolean;
}) {
  return callMerchantPaymentSettings('saveConfig', payload);
}

export function testMerchantPaymentCredentials(access_token?: string) {
  return callMerchantPaymentSettings('testCredentials', access_token ? { access_token } : undefined);
}

// Storefront/checkout calls authenticate as the logged-in BUYER, using the
// separate buyer Supabase client/session (see src/lib/supabaseBuyer.ts).
async function getBuyerAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabaseBuyer.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callMerchantPayments(action: string, payload?: unknown, requireAuth = true) {
  const headers = requireAuth
    ? await getBuyerAuthHeaders()
    : { 'Content-Type': 'application/json' };
  const resp = await fetch(PAYMENTS_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Falha no processamento');
  return data;
}

export interface SellerPublicKeyResult {
  public_key: string;
  environment: string;
}

export function getSellerPublicKey(storeOwnerId: string): Promise<SellerPublicKeyResult> {
  return callMerchantPayments('getSellerPublicKey', { store_owner_id: storeOwnerId }, false);
}

export interface OrderPixPaymentResult {
  order_payment_id: string;
  mp_payment_id: string;
  status: string;
  pix_qr_code: string;
  pix_qr_code_base64: string;
  pix_ticket_url: string;
  expires_at: string | null;
}

export interface OrderCardPaymentResult {
  order_payment_id: string;
  mp_payment_id: string;
  status: string;
  status_detail: string;
  card_last4: string;
}

export function createOrderPixPayment(args: {
  order_id: string;
  payer: { email: string; first_name: string; last_name: string; doc: string };
}): Promise<OrderPixPaymentResult> {
  return callMerchantPayments('createPixPayment', args);
}

export function createOrderCardPayment(args: {
  order_id: string;
  token: string;
  installments: number;
  payment_method_id: string;
  issuer_id: string;
  payer: { email: string; doc: string };
}): Promise<OrderCardPaymentResult> {
  return callMerchantPayments('createCardPayment', args);
}

export interface OrderPaymentStatus {
  id: string;
  status: string;
  status_detail: string;
  pix_qr_code: string;
  pix_qr_code_base64: string;
  pix_expires_at: string | null;
  card_last4: string;
  card_brand: string;
  payment_method: string;
  updated_at: string;
}

export function getOrderPaymentStatus(orderPaymentId: string): Promise<OrderPaymentStatus> {
  return callMerchantPayments('getPaymentStatus', { order_payment_id: orderPaymentId });
}
