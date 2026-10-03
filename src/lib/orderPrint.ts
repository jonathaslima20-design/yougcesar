import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import type { OrderStatus, User } from '@/types';

export const ORDER_STATUS_PRINT_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Em preparo',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUS_PRINT_LABELS: Record<string, string> = {
  not_applicable: 'Sem pagamento online',
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};

export const DELIVERY_SCOPE_PRINT_LABELS: Record<string, string> = {
  local: 'Entrega local',
  national: 'Entrega nacional',
  pickup: 'Retirada na loja',
};

export interface PrintStoreInfo {
  name: string;
  city: string | null;
  state: string | null;
  whatsapp: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  companyName: string | null;
  cnpj: string | null;
}

export interface OrderPaymentRow {
  id: string;
  payment_method: string;
  status: string;
  status_detail: string | null;
  amount_cents: number;
  card_last4: string | null;
  created_at: string;
}

export function buildPrintStoreInfo(
  user: User,
  company: { companyName: string | null; cnpj: string | null }
): PrintStoreInfo {
  return {
    name: user.name || user.slug || '',
    city: user.city ?? null,
    state: user.state ?? null,
    whatsapp: user.whatsapp || user.phone || null,
    countryCode: user.country_code ?? null,
    logoUrl: user.social_icon_url || user.avatar_url || null,
    companyName: company.companyName,
    cnpj: company.cnpj,
  };
}

export function formatBRL(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}

export function formatPrintDateTime(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatPrintDate(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR });
}

// Mascara o CPF deixando visível só o bloco do meio, o suficiente para
// conferir o cliente sem expor o documento completo no papel.
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatPhone(countryCode: string | null, phone: string): string {
  return countryCode ? `+${countryCode} ${phone}` : phone;
}

export function shortOrderCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function printFileTitle(orderId: string, createdAt: string): string {
  return `Pedido ${shortOrderCode(orderId)} - ${formatPrintDate(createdAt).replace(/\//g, '-')}`;
}

// Dados da empresa (razão social e CNPJ) ficam em storefront_appearance,
// preenchidos no rodapé do tema Eletrônicos. Se o lojista nunca preencheu,
// o cabeçalho simplesmente não mostra essas linhas.
export async function fetchPrintCompanyInfo(userId: string): Promise<{ companyName: string | null; cnpj: string | null }> {
  const { data } = await supabase
    .from('storefront_appearance')
    .select('footer_company_name, footer_cnpj')
    .eq('user_id', userId)
    .or('footer_company_name.not.is.null,footer_cnpj.not.is.null')
    .limit(1);

  const row = data?.[0];
  return {
    companyName: row?.footer_company_name?.trim() || null,
    cnpj: row?.footer_cnpj?.trim() || null,
  };
}

export async function fetchOrderPaymentHistory(orderId: string): Promise<OrderPaymentRow[]> {
  const { data } = await supabase
    .from('order_payments')
    .select('id, payment_method, status, status_detail, amount_cents, card_last4, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  return (data as OrderPaymentRow[] | null) ?? [];
}
