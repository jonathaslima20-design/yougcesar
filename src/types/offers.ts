export type OfferType = 'upgrade' | 'renovacao' | 'parceiro' | 'desconto_geral';
export type OfferTemplate = 'fullscreen' | 'modal_central' | 'banner_topo' | 'slide_lateral';
export type OfferAssignmentStatus = 'pendente' | 'visualizada' | 'aceita' | 'dispensada' | 'expirada';
export type OfferImpressionAction = 'exibida' | 'clicada' | 'fechada' | 'convertida';
export type OfferTrigger = 'ao_entrar' | 'apos_cadastrar_produto' | 'apos_atingir_limite' | 'ao_navegar_planos' | 'manual_apenas';
export type TargetingRuleType = 'plan_status' | 'dias_cadastro' | 'qtd_produtos' | 'billing_cycle' | 'dias_ate_vencimento' | 'atividade_recente' | 'plano_especifico';
export type TargetingOperator = 'igual' | 'diferente' | 'maior_que' | 'menor_que' | 'entre' | 'contem';

export interface PromotionalOffer {
  id: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  tipo_oferta: OfferType;
  imagem_url: string;
  desconto_percentual: number;
  desconto_valor_fixo: number;
  cupom_id?: string | null;
  plano_alvo_id?: string | null;
  url_destino: string;
  botao_texto: string;
  botao_cor: string;
  cor_fundo: string;
  cor_texto: string;
  cor_destaque: string;
  template: OfferTemplate;
  prioridade: number;
  is_active: boolean;
  data_inicio: string;
  data_fim?: string | null;
  mostrar_contador: boolean;
  parceiro_nome?: string | null;
  parceiro_logo_url?: string | null;
  is_parceiro: boolean;
  tracking_params?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferTargetingRule {
  id: string;
  offer_id: string;
  grupo_logico: number;
  tipo_regra: TargetingRuleType;
  operador: TargetingOperator;
  valor: string;
  valor_secundario: string;
  created_at: string;
}

export interface OfferUserAssignment {
  id: string;
  offer_id: string;
  user_id: string;
  assigned_by?: string | null;
  assigned_at: string;
  status: OfferAssignmentStatus;
  status_updated_at: string;
  notes: string;
  converted_at?: string | null;
}

export interface OfferRecipientSummary {
  assignment_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar_url?: string | null;
  status: OfferAssignmentStatus;
  assigned_at: string;
  status_updated_at: string;
  converted_at?: string | null;
  views_count: number;
  clicks_count: number;
  conversions_count: number;
  dismissals_count: number;
  last_action_at?: string | null;
  first_view_at?: string | null;
  first_click_at?: string | null;
  time_to_click_seconds?: number | null;
}

export interface OfferTimelineEvent {
  type: 'assigned' | 'exibida' | 'clicada' | 'fechada' | 'convertida' | 'status';
  at: string;
  context?: Record<string, unknown> | null;
  status?: OfferAssignmentStatus;
}

export interface OfferImpression {
  id: string;
  offer_id: string;
  user_id: string;
  action: OfferImpressionAction;
  session_context: Record<string, unknown>;
  created_at: string;
}

export interface OfferDisplayConfig {
  id: string;
  offer_id: string;
  max_exibicoes_por_usuario: number;
  intervalo_horas_entre_exibicoes: number;
  exibir_apos_minutos_navegando: number;
  gatilho_acao: OfferTrigger;
  horario_inicio_exibicao: string;
  horario_fim_exibicao: string;
}

export interface OfferWithConfig extends PromotionalOffer {
  display_config?: OfferDisplayConfig | null;
  targeting_rules?: OfferTargetingRule[];
  assignments_count?: number;
  impressions_count?: number;
  clicks_count?: number;
  conversions_count?: number;
}

export interface OfferFormData {
  titulo: string;
  subtitulo: string;
  descricao: string;
  tipo_oferta: OfferType;
  imagem_url: string;
  desconto_percentual: number;
  desconto_valor_fixo: number;
  cupom_id?: string | null;
  plano_alvo_id?: string | null;
  url_destino: string;
  botao_texto: string;
  botao_cor: string;
  cor_fundo: string;
  cor_texto: string;
  cor_destaque: string;
  template: OfferTemplate;
  prioridade: number;
  data_inicio: string;
  data_fim?: string | null;
  mostrar_contador: boolean;
  is_parceiro: boolean;
  parceiro_nome?: string | null;
  parceiro_logo_url?: string | null;
}

export interface OfferDisplayConfigFormData {
  max_exibicoes_por_usuario: number;
  intervalo_horas_entre_exibicoes: number;
  exibir_apos_minutos_navegando: number;
  gatilho_acao: OfferTrigger;
  horario_inicio_exibicao: string;
  horario_fim_exibicao: string;
}

export interface OfferAnalytics {
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_dismissals: number;
  ctr: number;
  conversion_rate: number;
  daily_data: {
    date: string;
    impressions: number;
    clicks: number;
    conversions: number;
  }[];
}
