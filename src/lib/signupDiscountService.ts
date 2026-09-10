import { supabase } from './supabase';
import { isExcludedFromOffers } from './offerService';

// Storage detail, not exposed to admin UI: the "desconto de boas-vindas" is a
// single promotional_offers row (reusing its schema and the discount-resolution
// logic the payment edge functions already trust via offer_id) identified by
// this specific display trigger, kept out of the general Ofertas manager.
const WELCOME_OFFER_TRIGGER = 'bloqueio_planos';

export interface SignupDiscountSettings {
  id: string | null;
  is_active: boolean;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  hours_after_signup: number;
  title: string;
  subtitle: string;
  highlight_color: string;
  background_color: string;
  plan_ids: string[];
}

const DEFAULT_SETTINGS: SignupDiscountSettings = {
  id: null,
  is_active: false,
  discount_type: 'percent',
  discount_value: 20,
  hours_after_signup: 24,
  title: 'Oferta de Boas-vindas',
  subtitle: 'Assine agora e garanta este desconto',
  highlight_color: '#10b981',
  background_color: '#ecfdf5',
  plan_ids: [],
};

export async function fetchSignupDiscountSettings(): Promise<SignupDiscountSettings> {
  const { data, error } = await supabase
    .from('promotional_offers')
    .select('*, offer_display_config!inner(gatilho_acao)')
    .eq('offer_display_config.gatilho_acao', WELCOME_OFFER_TRIGGER)
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;

  return {
    id: data.id,
    is_active: data.is_active,
    discount_type: data.desconto_percentual > 0 ? 'percent' : 'fixed',
    discount_value: data.desconto_percentual > 0 ? data.desconto_percentual : data.desconto_valor_fixo,
    hours_after_signup: data.contador_horas_apos_cadastro || 24,
    title: data.titulo || DEFAULT_SETTINGS.title,
    subtitle: data.subtitulo || '',
    highlight_color: data.cor_destaque || DEFAULT_SETTINGS.highlight_color,
    background_color: data.cor_fundo || DEFAULT_SETTINGS.background_color,
    plan_ids: data.planos_aplicaveis || [],
  };
}

export async function saveSignupDiscountSettings(settings: SignupDiscountSettings): Promise<void> {
  const payload = {
    titulo: settings.title.trim() || DEFAULT_SETTINGS.title,
    subtitulo: settings.subtitle,
    descricao: '',
    tipo_oferta: 'desconto_geral' as const,
    imagem_url: '',
    desconto_percentual: settings.discount_type === 'percent' ? settings.discount_value : 0,
    desconto_valor_fixo: settings.discount_type === 'fixed' ? settings.discount_value : 0,
    cupom_id: null,
    plano_alvo_id: null,
    url_destino: '',
    botao_texto: 'Assinar Agora',
    botao_cor: settings.highlight_color,
    cor_fundo: settings.background_color,
    cor_texto: '#1f2937',
    cor_destaque: settings.highlight_color,
    template: 'modal_central' as const,
    prioridade: 0,
    data_inicio: new Date().toISOString(),
    data_fim: null,
    mostrar_contador: true,
    planos_aplicaveis: settings.plan_ids.length > 0 ? settings.plan_ids : null,
    contador_modo: 'apos_cadastro' as const,
    contador_horas_apos_cadastro: settings.hours_after_signup,
    is_parceiro: false,
    is_active: settings.is_active,
  };

  if (settings.id) {
    const { error } = await supabase.from('promotional_offers').update(payload).eq('id', settings.id);
    if (error) throw error;
    return;
  }

  const { data: created, error } = await supabase
    .from('promotional_offers')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;

  const { error: configError } = await supabase.from('offer_display_config').insert({
    offer_id: created.id,
    gatilho_acao: WELCOME_OFFER_TRIGGER,
    max_exibicoes_por_usuario: 0,
    intervalo_horas_entre_exibicoes: 0,
    exibir_apos_minutos_navegando: 0,
    horario_inicio_exibicao: '00:00',
    horario_fim_exibicao: '23:59',
  });
  if (configError) throw configError;
}

export interface ActiveSignupDiscount {
  offer_id: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  title: string;
  subtitle: string;
  highlight_color: string;
  background_color: string;
  deadline: string;
  plan_ids: string[] | null;
}

// Runtime lookup used by useSignupOffer: is the welcome discount active, and
// hasn't this specific user's personal countdown already run out? SubscriptionBlocker
// only calls this for users who genuinely have no plan yet, so no further
// segmentation is needed here beyond the shared admin/partner/referred exclusion.
export async function fetchActiveSignupDiscount(user: {
  role?: string;
  managed_by_partner_id?: string | null;
  referred_by?: string | null;
  created_at: string;
}): Promise<ActiveSignupDiscount | null> {
  if (isExcludedFromOffers(user)) return null;

  const { data, error } = await supabase
    .from('promotional_offers')
    .select('*, offer_display_config!inner(gatilho_acao)')
    .eq('offer_display_config.gatilho_acao', WELCOME_OFFER_TRIGGER)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  const hasPercent = data.desconto_percentual > 0;
  const hasFixed = data.desconto_valor_fixo > 0;
  if (!hasPercent && !hasFixed) return null;
  if (!data.contador_horas_apos_cadastro) return null;

  const deadline = new Date(new Date(user.created_at).getTime() + data.contador_horas_apos_cadastro * 60 * 60 * 1000);
  if (deadline.getTime() <= Date.now()) return null; // this user's personal window already closed

  return {
    offer_id: data.id,
    discount_type: hasPercent ? 'percent' : 'fixed',
    discount_value: hasPercent ? data.desconto_percentual : data.desconto_valor_fixo,
    title: data.titulo || DEFAULT_SETTINGS.title,
    subtitle: data.subtitulo || '',
    highlight_color: data.cor_destaque || DEFAULT_SETTINGS.highlight_color,
    background_color: data.cor_fundo || DEFAULT_SETTINGS.background_color,
    deadline: deadline.toISOString(),
    plan_ids: data.planos_aplicaveis && data.planos_aplicaveis.length > 0 ? data.planos_aplicaveis : null,
  };
}
