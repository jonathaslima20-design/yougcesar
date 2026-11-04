import { supabase } from '@/lib/supabase';
import { formatCurrencyI18n } from '@/lib/i18n';

export type PartnerTeamRole = 'owner' | 'manager' | 'operator';
export type PartnerType = 'freelancer' | 'agency' | 'consultant' | 'creator';
export type CommissionStatus = 'holding' | 'available' | 'requested' | 'paid' | 'reversed';
export type CommissionType = 'new' | 'renewal' | 'bonus' | 'override' | 'clawback' | 'adjustment';
export type LeadStage = 'contact' | 'proposal' | 'trial' | 'won' | 'lost';
export type ClientHealth = 'healthy' | 'setup' | 'at_risk' | 'renewing' | 'lapsed' | 'blocked';

export interface PartnerLevel {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  min_mrr: number;
  min_active_clients: number;
  commission_percentage: number;
  benefits: string[];
  color: string | null;
  requires_certification: boolean;
  is_active: boolean;
}

export interface PartnerOverview {
  team_role: PartnerTeamRole;
  partner_id: string;
  status: 'approved' | 'suspended' | 'terminated' | null;
  active_clients: number;
  mrr: number;
  rate: number;
  level: PartnerLevel | null;
  next_level: PartnerLevel | null;
  level_below_since: string | null;
  is_founder: boolean;
  payouts_frozen: boolean;
  certified_at: string | null;
  balance: { holding: number; available: number; requested: number; paid: number; reversed: number } | null;
}

export interface PartnerProfile {
  user_id: string;
  partner_type: PartnerType;
  status: string;
  company_name: string | null;
  document: string | null;
  document_type: 'cpf' | 'cnpj' | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  niches: string[];
  services: string[];
  bio: string | null;
  logo_url: string | null;
  public_slug: string | null;
  is_public: boolean;
  is_founder: boolean;
  terms_version: string | null;
  terms_accepted_at: string | null;
  onboarding: Record<string, boolean>;
  certified_at: string | null;
  approved_at: string;
}

export interface PartnerClient {
  id: string;
  name: string;
  owner_name: string | null;
  email: string;
  whatsapp: string | null;
  slug: string | null;
  plan_status: string;
  trial_ends_at: string | null;
  is_blocked: boolean;
  created_at: string;
  last_login_at: string | null;
  plan_name: string | null;
  plan_price: number | null;
  billing_cycle: string | null;
  next_payment_date: string | null;
  monthly_value: number | null;
  products_count: number;
  orders_30d: number;
  has_custom_domain: boolean;
  access_granted: boolean;
  client_accepted: boolean;
  origin: string;
  commission_total: number | null;
  health: ClientHealth;
}

export interface PartnerLink {
  id: string;
  partner_id: string;
  slug: string;
  name: string;
  destination: string;
  offer: 'none' | 'trial';
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  coupon_code: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PartnerLead {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  company: string | null;
  niche: string | null;
  estimated_value: number | null;
  stage: LeadStage;
  source: 'manual' | 'directory' | 'vitrineturbo';
  notes: string | null;
  next_action_at: string | null;
  protected_until: string | null;
  converted_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerCommission {
  id: string;
  partner_id: string;
  managed_user_id: string | null;
  plan_name: string | null;
  plan_price: number | null;
  commission_percentage: number | null;
  amount: number;
  type: CommissionType;
  status: CommissionStatus;
  installment_number: number;
  installment_total: number;
  available_at: string | null;
  created_at: string;
  paid_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  description: string | null;
  withdrawal_id: string | null;
}

export interface PartnerCampaign {
  id: string;
  name: string;
  description: string | null;
  kind: 'multiplier' | 'goal';
  starts_at: string;
  ends_at: string;
  multiplier: number | null;
  goal_new_clients: number | null;
  goal_bonus_amount: number | null;
  is_active: boolean;
}

export interface PartnerFunnelRow {
  link_id: string | null;
  link_name: string;
  link_slug: string | null;
  clicks: number;
  signups: number;
  paying: number;
}

export interface PartnerSettings {
  is_active: boolean;
  minimum_withdrawal_amount: number;
  holding_days: number;
  store_trial_days: number;
  terms_version: string;
  demo_store_url: string | null;
  community_url: string | null;
  support_whatsapp: string | null;
  webinar_url: string | null;
  webinar_at: string | null;
  first_sale_bonus_amount: number;
  first_sale_bonus_days: number;
  recruit_override_percentage: number;
  recruit_override_months: number;
  lead_protection_days: number;
  max_pf_monthly_payout: number;
  payout_day: number;
  attribution_window_days: number;
}

export interface PublicProgramInfo {
  is_active: boolean;
  holding_days: number;
  first_sale_bonus_amount: number;
  first_sale_bonus_days: number;
  recruit_override_percentage: number;
  recruit_override_months: number;
  store_trial_days: number;
  minimum_withdrawal_amount: number;
  terms_version: string;
  founder_bonus_pp: number;
  founder_slots: number;
  founder_slots_left: number;
  levels: Pick<PartnerLevel, 'slug' | 'name' | 'min_mrr' | 'min_active_clients' | 'commission_percentage' | 'benefits' | 'color'>[];
  plans: { name: string; price: number; duration: string }[];
}

export const formatBRL = (value: number | null | undefined) => formatCurrencyI18n(Number(value ?? 0), 'BRL', 'pt-BR');

export const SITE_URL = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)
  ? window.location.origin
  : 'https://vitrineturbo.com';

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  freelancer: 'Freelancer / social media',
  agency: 'Agência de marketing',
  consultant: 'Consultor / gestor de tráfego',
  creator: 'Criador de conteúdo / educador',
};

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  contact: 'Contato',
  proposal: 'Proposta',
  trial: 'Em teste',
  won: 'Fechado',
  lost: 'Perdido',
};

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  holding: 'Em carência',
  available: 'Disponível',
  requested: 'Saque solicitado',
  paid: 'Pago',
  reversed: 'Estornado',
};

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  new: 'Nova assinatura',
  renewal: 'Renovação',
  bonus: 'Bônus',
  override: 'Indicação de parceiro',
  clawback: 'Estorno',
  adjustment: 'Ajuste',
};

export const HEALTH_LABELS: Record<ClientHealth, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'muted' }> = {
  healthy: { label: 'Saudável', tone: 'green' },
  setup: { label: 'Em implantação', tone: 'blue' },
  at_risk: { label: 'Em risco', tone: 'amber' },
  renewing: { label: 'Renova em breve', tone: 'blue' },
  lapsed: { label: 'Plano vencido', tone: 'red' },
  blocked: { label: 'Bloqueado', tone: 'muted' },
};

export const LINK_DESTINATIONS: { value: string; label: string }[] = [
  { value: '/', label: 'Página inicial' },
  { value: '/register', label: 'Cadastro direto' },
  { value: '/planos', label: 'Planos e preços' },
  { value: '/catalogo-para-whatsapp', label: 'Catálogo para WhatsApp' },
  { value: '/loja-virtual-sem-taxa', label: 'Loja virtual sem taxa' },
  { value: '/dominio-proprio', label: 'Domínio próprio' },
];

export function partnerLinkUrl(publicSlug: string | null | undefined, link: Pick<PartnerLink, 'slug'>) {
  if (!publicSlug) return '';
  return link.slug === 'inicio' ? `${SITE_URL}/p/${publicSlug}` : `${SITE_URL}/p/${publicSlug}/${link.slug}`;
}

export function whatsappShareUrl(text: string, phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '');
  const target = digits ? (digits.length <= 11 ? `55${digits}` : digits) : '';
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // supabase-js wraps non-2xx responses; surface the function's own message.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json();
        if (payload?.error) throw new Error(payload.error);
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
    if ((error as { name?: string }).name === 'FunctionsFetchError') {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.');
    }
    throw new Error(error.message || 'Erro inesperado');
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const partnerApi = {
  overview: async () => unwrap<PartnerOverview>(await supabase.rpc('partner_overview')),
  settings: async () =>
    unwrap<PartnerSettings>(await supabase.from('partner_settings').select('*').limit(1).maybeSingle()),
  // Internal notes stay hidden; the document only comes back to the account owner.
  profile: async (_userId: string) =>
    unwrap<PartnerProfile | null>(await supabase.rpc('my_partner_profile')),
  updateProfile: async (userId: string, patch: Partial<PartnerProfile>) =>
    unwrap(await supabase.from('partner_profiles').update(patch).eq('user_id', userId)),
  levels: async () =>
    unwrap<PartnerLevel[]>(await supabase.from('partner_levels').select('*').eq('is_active', true).order('sort_order')),
  clients: async () => unwrap<PartnerClient[]>(await supabase.rpc('partner_clients')),
  funnel: async (days: number) => unwrap<PartnerFunnelRow[]>(await supabase.rpc('partner_funnel', { p_days: days })),
  campaigns: async () =>
    unwrap<PartnerCampaign[]>(
      await supabase.from('partner_campaigns').select('*').eq('is_active', true).gte('ends_at', new Date().toISOString()).order('ends_at'),
    ),

  links: async () => unwrap<PartnerLink[]>(await supabase.from('partner_links').select('*').order('created_at')),
  saveLink: async (link: Partial<PartnerLink> & { partner_id: string }) =>
    link.id
      ? unwrap(await supabase.from('partner_links').update(link).eq('id', link.id))
      : unwrap(await supabase.from('partner_links').insert(link)),
  deleteLink: async (id: string) => unwrap(await supabase.from('partner_links').delete().eq('id', id)),

  leads: async () => unwrap<PartnerLead[]>(await supabase.from('partner_leads').select('*').order('updated_at', { ascending: false })),
  saveLead: async (lead: Partial<PartnerLead> & { partner_id: string }) =>
    lead.id
      ? unwrap(await supabase.from('partner_leads').update(lead).eq('id', lead.id))
      : unwrap(await supabase.from('partner_leads').insert(lead)),
  deleteLead: async (id: string) => unwrap(await supabase.from('partner_leads').delete().eq('id', id)),

  commissions: async (partnerId: string) =>
    unwrap<PartnerCommission[]>(
      await supabase.from('partner_commissions').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false }),
    ),
  requestWithdrawal: async (pixKeyId: string, invoiceUrl?: string | null) =>
    unwrap<string>(await supabase.rpc('partner_request_withdrawal', { p_pix_key_id: pixKeyId, p_invoice_url: invoiceUrl ?? null })),

  createStore: (body: { name: string; email: string; whatsapp: string; store_name?: string; country_code?: string; niche?: string; lead_id?: string }) =>
    invokeFunction<{ user_id: string; slug: string; invite_url: string; invite_expires_at: string; trial_days: number }>('partner-store', {
      action: 'create_store',
      ...body,
    }),
  sendInvite: (userId: string) =>
    invokeFunction<{ invite_url: string; invite_expires_at: string }>('partner-store', { action: 'send_invite', user_id: userId }),
  openStore: (userId: string) =>
    invokeFunction<{ hashedToken: string; store_name: string }>('partner-store', { action: 'open_store', user_id: userId }),
  inviteTeamMember: (body: { name: string; email: string; team_role: 'manager' | 'operator' }) =>
    invokeFunction<{ user_id: string; invite_url: string }>('partner-store', { action: 'team_invite', ...body }),
  removeTeamMember: (userId: string) => invokeFunction<{ success: boolean }>('partner-store', { action: 'team_remove', user_id: userId }),

  inspectInvite: (token: string) =>
    invokeFunction<{ kind: 'partner' | 'client' | 'team'; name: string; email: string; partner_name: string | null }>('partner-invites', {
      action: 'inspect',
      token,
    }),
  redeemInvite: (token: string) =>
    invokeFunction<{ hashedToken: string; kind: 'partner' | 'client' | 'team'; email: string; name: string; partner_name: string | null }>(
      'partner-invites',
      { action: 'redeem', token },
    ),

  publicInfo: async () => unwrap<PublicProgramInfo>(await supabase.rpc('get_partner_program_public_info')),
  submitApplication: async (payload: Record<string, unknown>) =>
    unwrap<{ id: string }>(await supabase.rpc('submit_partner_application', { p: payload })),
};

export const partnerAdminApi = {
  approveApplication: (applicationId: string, options: { level_slug?: string; founder?: boolean } = {}) =>
    invokeFunction<{ user_id: string; invite_url: string; whatsapp: string; name: string; founder: boolean }>('partner-admin', {
      action: 'approve_application',
      application_id: applicationId,
      ...options,
    }),
  regenerateInvite: (userId: string) =>
    invokeFunction<{ invite_url: string; invite_expires_at: string }>('partner-admin', { action: 'regenerate_invite', user_id: userId }),
  processWithdrawal: async (id: string, action: 'pay' | 'reject', notes?: string, receiptUrl?: string | null) =>
    unwrap(
      await supabase.rpc('admin_partner_process_withdrawal', {
        p_withdrawal_id: id,
        p_action: action,
        p_notes: notes ?? null,
        p_receipt_url: receiptUrl ?? null,
      }),
    ),
  reassignClient: async (userId: string, partnerId: string | null, reason: string) =>
    unwrap(await supabase.rpc('admin_partner_reassign_client', { p_user_id: userId, p_partner_id: partnerId, p_reason: reason })),
};

/** Uploads a file to the private partner-documents bucket under the caller's folder. */
export async function uploadPartnerDocument(ownerId: string, file: File, prefix: string) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const path = `${ownerId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('partner-documents').upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedPartnerDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from('partner-documents').createSignedUrl(path, 60 * 10);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Opens a managed client's store in this tab (the partner session is replaced). */
export async function openClientStore(clientId: string, partnerEmail: string | undefined) {
  const { hashedToken, store_name } = await partnerApi.openStore(clientId);
  try {
    localStorage.setItem('vt_partner_return', JSON.stringify({ email: partnerEmail ?? '', store: store_name, at: Date.now() }));
  } catch {
    /* storage unavailable: the banner just won't show */
  }
  window.location.href = `/auth/callback?impersonate_token=${encodeURIComponent(hashedToken)}`;
}
