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
  public_key_test: string;
  access_token_test: string;
  public_key_prod: string;
  access_token_prod: string;
  webhook_secret: string;
  is_active: boolean;
}) {
  return callMerchantPaymentSettings('saveConfig', payload);
}

export function testMerchantPaymentCredentials() {
  return callMerchantPaymentSettings('testCredentials');
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
  // The buyer is always authenticated by the time OrderPaymentPage mounts
  // (order creation requires buyer_id), so send the buyer's token like every
  // other call in this file — the previous requireAuth=false sent no
  // Authorization header at all, which the Supabase Functions gateway
  // rejects with a 401 before this project's own code ever runs.
  return callMerchantPayments('getSellerPublicKey', { store_owner_id: storeOwnerId });
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
  payer: { email: string; first_name: string; last_name: string; doc: string };
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
