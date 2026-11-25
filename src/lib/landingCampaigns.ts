import { supabase } from './supabase';

// Seasonal campaigns (Black Friday, Natal, Ano Novo...) are a DISPLAY-ONLY layer
// on the landing pricing section. They never reach checkout or the payment edge
// functions: the discount a new user actually gets after signup is still the one
// configured in Admin > Desconto de Boas-vindas. Keeping it display-only is what
// guarantees a renewal can never pick up a campaign discount.

export type CampaignTheme = 'black_friday' | 'natal' | 'ano_novo' | 'consumidor' | 'personalizada';

export interface LandingCampaign {
  id: string;
  name: string;
  theme: CampaignTheme;
  title: string;
  subtitle: string;
  badge_text: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  /** Landing plan ids ('mensal' | 'semestral' | 'anual'); empty = all plans. */
  plan_ids: string[];
  starts_at: string;
  ends_at: string;
  show_ribbon: boolean;
  show_countdown: boolean;
  show_top_bar: boolean;
  primary_color: string;
  accent_color: string;
  text_color: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type LandingCampaignInput = Omit<LandingCampaign, 'id' | 'created_at' | 'updated_at'>;

export interface CampaignThemePreset {
  id: CampaignTheme;
  label: string;
  emoji: string;
  name: string;
  title: string;
  subtitle: string;
  badge_text: string;
  primary_color: string;
  accent_color: string;
  text_color: string;
}

export const CAMPAIGN_THEMES: CampaignThemePreset[] = [
  {
    id: 'black_friday',
    label: 'Black Friday',
    emoji: '🖤',
    name: 'Black Friday',
    title: 'Black Friday VitrineTurbo',
    subtitle: 'O menor preço do ano para tirar sua loja do papel.',
    badge_text: 'Black Friday',
    primary_color: '#0A0A0A',
    accent_color: '#F5B301',
    text_color: '#FFFFFF',
  },
  {
    id: 'natal',
    label: 'Natal',
    emoji: '🎄',
    name: 'Oferta de Natal',
    title: 'Natal com a loja no ar',
    subtitle: 'Presente pra você: desconto especial nos planos.',
    badge_text: 'Oferta de Natal',
    primary_color: '#14532D',
    accent_color: '#EF4444',
    text_color: '#FFFFFF',
  },
  {
    id: 'ano_novo',
    label: 'Ano Novo',
    emoji: '🎆',
    name: 'Oferta de Ano Novo',
    title: 'Ano novo, loja nova',
    subtitle: 'Comece o ano vendendo mais com desconto nos planos.',
    badge_text: 'Ano Novo',
    primary_color: '#0F172A',
    accent_color: '#FACC15',
    text_color: '#FFFFFF',
  },
  {
    id: 'consumidor',
    label: 'Dia do Consumidor',
    emoji: '🛍️',
    name: 'Semana do Consumidor',
    title: 'Semana do Consumidor',
    subtitle: 'Preços especiais por tempo limitado.',
    badge_text: 'Semana do Consumidor',
    primary_color: '#4C1D95',
    accent_color: '#F472B6',
    text_color: '#FFFFFF',
  },
  {
    id: 'personalizada',
    label: 'Personalizada',
    emoji: '✨',
    name: 'Campanha especial',
    title: 'Oferta especial',
    subtitle: 'Desconto por tempo limitado nos planos.',
    badge_text: 'Oferta',
    primary_color: '#0A0A0A',
    accent_color: '#10B981',
    text_color: '#FFFFFF',
  },
];

export function getThemePreset(theme: CampaignTheme): CampaignThemePreset {
  return CAMPAIGN_THEMES.find((t) => t.id === theme) ?? CAMPAIGN_THEMES[CAMPAIGN_THEMES.length - 1];
}

/** Plans shown on the BRL landing pricing section (ids match PAID_PLANS). */
export const LANDING_PLAN_OPTIONS = [
  { id: 'mensal', label: 'Mensal' },
  { id: 'semestral', label: 'Semestral' },
  { id: 'anual', label: 'Anual' },
];

export function campaignAppliesToPlan(campaign: Pick<LandingCampaign, 'plan_ids'>, planId: string): boolean {
  return campaign.plan_ids.length === 0 || campaign.plan_ids.includes(planId);
}

/** '57,00' → 57 */
export function parseBRL(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

/** 57 → '57,00' */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function applyCampaignDiscount(
  price: number,
  campaign: Pick<LandingCampaign, 'discount_type' | 'discount_value'>
): number {
  const discount = campaign.discount_type === 'percent'
    ? (price * campaign.discount_value) / 100
    : campaign.discount_value;
  return Math.max(0, Math.round((price - discount) * 100) / 100);
}

export function formatCampaignDiscount(campaign: Pick<LandingCampaign, 'discount_type' | 'discount_value'>): string {
  return campaign.discount_type === 'percent'
    ? `${Number(campaign.discount_value).toLocaleString('pt-BR')}% OFF`
    : `R$ ${formatBRL(Number(campaign.discount_value))} OFF`;
}

export type CampaignStatus = 'live' | 'scheduled' | 'ended' | 'paused';

export function getCampaignStatus(campaign: Pick<LandingCampaign, 'is_active' | 'starts_at' | 'ends_at'>, now = Date.now()): CampaignStatus {
  if (!campaign.is_active) return 'paused';
  if (new Date(campaign.ends_at).getTime() <= now) return 'ended';
  if (new Date(campaign.starts_at).getTime() > now) return 'scheduled';
  return 'live';
}

function normalize(row: any): LandingCampaign {
  return {
    ...row,
    discount_value: Number(row.discount_value) || 0,
    plan_ids: row.plan_ids || [],
  };
}

// --- Public (landing) ---

/** The campaign live right now, or null. RLS only exposes live rows to visitors. */
export async function fetchLiveLandingCampaign(): Promise<LandingCampaign | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('landing_campaigns')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data);
}

// --- Admin ---

export async function fetchLandingCampaigns(): Promise<LandingCampaign[]> {
  const { data, error } = await supabase
    .from('landing_campaigns')
    .select('*')
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

export async function saveLandingCampaign(id: string | null, input: LandingCampaignInput): Promise<void> {
  const payload = {
    ...input,
    plan_ids: input.plan_ids.length === LANDING_PLAN_OPTIONS.length ? [] : input.plan_ids,
  };
  const { error } = id
    ? await supabase.from('landing_campaigns').update(payload).eq('id', id)
    : await supabase.from('landing_campaigns').insert(payload);
  if (error) throw translateCampaignError(error);
}

export async function setLandingCampaignActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from('landing_campaigns').update({ is_active }).eq('id', id);
  if (error) throw translateCampaignError(error);
}

export async function deleteLandingCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('landing_campaigns').delete().eq('id', id);
  if (error) throw error;
}

function translateCampaignError(error: { code?: string; message: string }): Error {
  if (error.code === '23P01') {
    return new Error('Já existe outra campanha ativa nesse período. Ajuste as datas ou pause a outra campanha.');
  }
  if (error.code === '23514') {
    return new Error('Verifique as datas (o fim deve ser depois do início) e o valor do desconto.');
  }
  return new Error(error.message);
}
