import { supabase } from './supabase';

export type SalesEnvironment = 'production' | 'test';

export interface OnlineSalesTotals {
  attempts: number;
  approved_count: number;
  approved_cents: number;
  fee_cents: number;
  fee_estimated_count: number;
  refunded_count: number;
  refunded_cents: number;
  failed_count: number;
  failed_cents: number;
  expired_count: number;
  expired_cents: number;
  pending_count: number;
  selling_merchants: number;
}

export interface MethodBreakdown {
  method: string;
  approved_count: number;
  approved_cents: number;
  fee_cents: number;
  failed_count: number;
  attempts: number;
}

export interface DailyPoint {
  day: string;
  approved_count: number;
  approved_cents: number;
  fee_cents: number;
  failed_count: number;
}

export interface FailureReason {
  reason: string;
  count: number;
  cents: number;
}

export interface OnlineSalesOverview {
  fee_percentage: number;
  totals: OnlineSalesTotals;
  by_method: MethodBreakdown[];
  daily: DailyPoint[];
  failure_reasons: FailureReason[];
}

export interface MerchantSalesRow {
  user_id: string;
  name: string | null;
  email: string | null;
  slug: string | null;
  has_credentials: boolean;
  is_active: boolean;
  environment: SalesEnvironment | null;
  oauth_connected: boolean;
  has_token: boolean;
  mp_account_email: string | null;
  mp_user_id: string | null;
  token_expires_at: string | null;
  last_validated_at: string | null;
  connected_since: string | null;
  attempts: number;
  approved_count: number;
  approved_cents: number;
  fee_cents: number;
  failed_count: number;
  expired_count: number;
  refunded_count: number;
  refunded_cents: number;
  last_sale_at: string | null;
}

export interface FailedPaymentRow {
  id: string;
  created_at: string;
  status: 'rejected' | 'cancelled' | 'expired';
  status_detail: string | null;
  payment_method: string;
  card_brand: string | null;
  installments: number | null;
  amount_cents: number;
  payer_email: string | null;
  order_id: string;
  mp_payment_id: string | null;
  customer_name: string | null;
  store_owner_id: string;
  store_name: string | null;
  store_slug: string | null;
}

export interface FailedPaymentsPage {
  total: number;
  rows: FailedPaymentRow[];
}

export interface SalesWindow {
  from: Date;
  to: Date;
  environment: SalesEnvironment;
}

function windowArgs({ from, to, environment }: SalesWindow) {
  return { p_from: from.toISOString(), p_to: to.toISOString(), p_environment: environment };
}

export async function fetchOnlineSalesOverview(w: SalesWindow): Promise<OnlineSalesOverview> {
  const { data, error } = await supabase.rpc('admin_online_sales_overview', windowArgs(w));
  if (error) throw new Error(error.message);
  return data as OnlineSalesOverview;
}

export async function fetchOnlineSalesByMerchant(w: SalesWindow): Promise<MerchantSalesRow[]> {
  const { data, error } = await supabase.rpc('admin_online_sales_by_merchant', windowArgs(w));
  if (error) throw new Error(error.message);
  return (data ?? []) as MerchantSalesRow[];
}

export async function fetchFailedPayments(w: SalesWindow, limit: number, offset: number): Promise<FailedPaymentsPage> {
  const { data, error } = await supabase.rpc('admin_failed_payments', {
    ...windowArgs(w),
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return data as FailedPaymentsPage;
}

// --- Connection health -----------------------------------------------------

export type ConnectionState = 'connected' | 'paused' | 'expired' | 'reconnect' | 'incomplete';

const EXPIRING_SOON_DAYS = 30;

// "connected" = finished OAuth (refresh_token present) and online payments on.
// "paused"    = OAuth done but the merchant switched online payments off.
// "expired"   = OAuth done but the access token's expiry date already passed —
//               the refresh cron should have renewed it, so something failed.
// "reconnect" = has a token but never went through OAuth (old paste-your-key
//               model) — checkout refuses these, so they need to reconnect.
// "incomplete"= a credentials row with no token at all (started, never finished).
export function getConnectionState(row: MerchantSalesRow, now = new Date()): ConnectionState {
  if (row.oauth_connected) {
    if (row.token_expires_at && new Date(row.token_expires_at) < now) return 'expired';
    return row.is_active ? 'connected' : 'paused';
  }
  return row.has_token ? 'reconnect' : 'incomplete';
}

export function daysUntilExpiry(row: MerchantSalesRow, now = new Date()): number | null {
  if (!row.token_expires_at) return null;
  return Math.floor((new Date(row.token_expires_at).getTime() - now.getTime()) / 86_400_000);
}

export function isExpiringSoon(row: MerchantSalesRow, now = new Date()): boolean {
  if (!row.oauth_connected) return false;
  const days = daysUntilExpiry(row, now);
  return days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS;
}

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connected: 'Conectado',
  paused: 'Conectado (pausado)',
  expired: 'Token vencido',
  reconnect: 'Precisa reconectar',
  incomplete: 'Conexão incompleta',
};

// --- Labels ------------------------------------------------------------------

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
};

const FAILURE_REASON_LABELS: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Saldo/limite insuficiente',
  cc_rejected_bad_filled_security_code: 'CVV incorreto',
  cc_rejected_bad_filled_date: 'Data de validade incorreta',
  cc_rejected_bad_filled_card_number: 'Número do cartão incorreto',
  cc_rejected_bad_filled_other: 'Dados do cartão incorretos',
  cc_rejected_call_for_authorize: 'Banco pediu autorização por telefone',
  cc_rejected_card_disabled: 'Cartão desabilitado',
  cc_rejected_duplicated_payment: 'Pagamento duplicado',
  cc_rejected_high_risk: 'Recusado pelo antifraude',
  cc_rejected_max_attempts: 'Limite de tentativas atingido',
  cc_rejected_other_reason: 'Recusado pelo banco (sem motivo informado)',
  cc_rejected_blacklist: 'Cartão em lista de bloqueio',
  cc_rejected_invalid_installments: 'Parcelamento inválido',
  cc_rejected_card_error: 'Erro no cartão',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  expired: 'Pix expirado (não pago)',
};

export function describeFailureReason(reason: string): string {
  return FAILURE_REASON_LABELS[reason] ?? reason.replace(/^cc_rejected_/, '').replace(/_/g, ' ');
}

// --- Formatting --------------------------------------------------------------

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
}

export function formatPercent(value: number, digits = 1): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)}%`;
}

// Approved out of every attempt that reached a final outcome — pending
// payments are excluded so an open Pix doesn't drag the rate down.
export function approvalRate(approved: number, failed: number, expired: number): number | null {
  const finished = approved + failed + expired;
  return finished === 0 ? null : (approved / finished) * 100;
}
