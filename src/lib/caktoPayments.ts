import { supabase } from './supabase';

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cakto`;

const SDK_SCRIPT_SRC = 'https://cakto-sdk.pages.dev/cakto-sdk.min.js';
const SDK_SCRIPT_ID = 'cakto-sdk-script';

declare global {
  interface Window {
    Cakto?: {
      CaktoSDK: new (options: { client_id: string }) => CaktoSdkInstance;
    };
  }
}

export interface CaktoSdkInstance {
  initAntifraud(): Promise<void>;
  completeAntifraudProfile(): Promise<void>;
  getAntifraudReference(): string;
  createToken(card: {
    holderName: string;
    cardNumber: string;
    cvv: string;
    expMonth: string;
    expYear: string;
  }): Promise<{ cardToken: string }>;
}

// Loads the Cakto SDK (tokenization + antifraud + 3DS), a CDN bundle that
// exposes window.Cakto — there's no npm package, per the Cakto docs.
export function loadCaktoSdkScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.getElementById(SDK_SCRIPT_ID) && window.Cakto) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar SDK da Cakto')));
      return;
    }

    const script = document.createElement('script');
    script.id = SDK_SCRIPT_ID;
    script.src = SDK_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar SDK da Cakto'));
    document.head.appendChild(script);
  });
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callCakto(action: string, payload?: any) {
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

export interface CaktoCustomerInfo {
  email: string;
  name: string;
  phone: string;
  doc: string;
  fingerprint: string;
}

export interface CaktoPixPaymentArgs {
  plan_id: string;
  billing_cycle: string;
  customer: CaktoCustomerInfo;
  early_renewal?: boolean;
  offer_id?: string;
  referral_code?: string;
}

export interface CaktoCardPaymentArgs {
  plan_id: string;
  billing_cycle: string;
  card_token: string;
  antifraud_reference: string;
  installments: number;
  customer: CaktoCustomerInfo;
  early_renewal?: boolean;
  offer_id?: string;
  referral_code?: string;
}

export interface CaktoPixPaymentResult {
  payment_id: string;
  cakto_order_id: string;
  status: string;
  pix_qr_code: string;
  expires_at: string | null;
}

export interface CaktoCardPaymentResult {
  payment_id: string;
  cakto_order_id: string;
  status: string;
}

export interface CaktoPaymentStatus {
  id: string;
  status: string;
  status_detail: string;
  pix_qr_code: string;
  pix_expires_at: string | null;
  card_last4: string;
  card_brand: string;
  payment_method: string;
  updated_at: string;
}

export function getPublicKey(): Promise<{ sdk_client_id: string; environment: string; pix_enabled: boolean }> {
  return callCakto('getPublicKey');
}

export function createPixPayment(args: CaktoPixPaymentArgs): Promise<CaktoPixPaymentResult> {
  return callCakto('createPixPayment', args);
}

export function createCardPayment(args: CaktoCardPaymentArgs): Promise<CaktoCardPaymentResult> {
  return callCakto('createCardPayment', args);
}

export function getPaymentStatus(paymentId: string): Promise<CaktoPaymentStatus> {
  return callCakto('getPaymentStatus', { payment_id: paymentId });
}
