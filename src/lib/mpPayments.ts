import { supabase } from './supabase';

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago`;
const ADMIN_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-admin`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callMercadoPago(action: string, payload?: any) {
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

async function callMpAdmin(action: string, payload?: any) {
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

export interface PixPaymentArgs {
  plan_id: string;
  billing_cycle: string;
  payer: {
    email: string;
    first_name: string;
    last_name: string;
    doc: string;
  };
  early_renewal?: boolean;
  offer_id?: string;
  referral_code?: string;
}

export interface CardPaymentArgs {
  plan_id: string;
  billing_cycle: string;
  token: string;
  installments: number;
  payment_method_id: string;
  issuer_id: string;
  payer: {
    email: string;
    doc: string;
  };
  early_renewal?: boolean;
  offer_id?: string;
  referral_code?: string;
}

export interface PixPaymentResult {
  payment_id: string;
  mp_payment_id: string;
  status: string;
  pix_qr_code: string;
  pix_qr_code_base64: string;
  pix_ticket_url: string;
  expires_at: string | null;
}

export interface CardPaymentResult {
  payment_id: string;
  mp_payment_id: string;
  status: string;
  status_detail: string;
  card_last4: string;
}

export interface PaymentStatus {
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

export function getPublicKey(): Promise<{ public_key: string; environment: string }> {
  return callMercadoPago('getPublicKey');
}

export function createPixPayment(args: PixPaymentArgs): Promise<PixPaymentResult> {
  return callMercadoPago('createPixPayment', args);
}

export function createCardPayment(args: CardPaymentArgs): Promise<CardPaymentResult> {
  return callMercadoPago('createCardPayment', args);
}

export function getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  return callMercadoPago('getPaymentStatus', { payment_id: paymentId });
}

export function getAdminConfig() {
  return callMpAdmin('getConfig');
}

export function saveAdminConfig(payload: any) {
  return callMpAdmin('saveConfig', payload);
}

export function testAdminCredentials() {
  return callMpAdmin('testCredentials');
}
