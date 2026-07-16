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

const CARD_REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: 'Número do cartão incorreto. Confira e tente novamente.',
  cc_rejected_bad_filled_date: 'Data de validade incorreta. Confira e tente novamente.',
  cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) incorreto. Confira e tente novamente.',
  cc_rejected_bad_filled_other: 'Revise os dados do cartão e tente novamente.',
  cc_rejected_blacklist: 'Cartão não autorizado. Entre em contato com o seu banco.',
  cc_rejected_call_for_authorize: 'Você precisa autorizar este pagamento diretamente com o seu banco.',
  cc_rejected_card_disabled: 'Cartão desabilitado. Ligue para o seu banco para ativá-lo ou use outro cartão.',
  cc_rejected_card_error: 'Não foi possível processar o pagamento. Tente novamente em instantes.',
  cc_rejected_duplicated_payment: 'Já existe um pagamento igual realizado recentemente.',
  cc_rejected_high_risk: 'Pagamento recusado por segurança. Tente outro cartão ou use o Pix.',
  cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão.',
  cc_rejected_invalid_installments: 'Número de parcelas não disponível para este cartão.',
  cc_rejected_max_attempts: 'Limite de tentativas atingido. Tente novamente mais tarde ou use outro cartão.',
  cc_rejected_other_reason: 'Pagamento recusado pelo seu banco. Tente outro cartão ou use o Pix.',
};

export function translateCardRejection(statusDetail: string): string {
  return CARD_REJECTION_MESSAGES[statusDetail] || 'Pagamento recusado. Verifique os dados do cartão ou tente outro meio de pagamento.';
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
