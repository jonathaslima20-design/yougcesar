/*
  # Create Promotional Offers System

  1. New Tables
    - `promotional_offers` - Main offers table
      - `id` (uuid, primary key)
      - `titulo` (text) - Offer title
      - `subtitulo` (text) - Offer subtitle
      - `descricao` (text) - Rich text description
      - `tipo_oferta` (text) - Type: upgrade, renovacao, parceiro, desconto_geral
      - `imagem_url` (text) - Background/featured image URL
      - `desconto_percentual` (numeric) - Percentage discount
      - `desconto_valor_fixo` (numeric) - Fixed value discount
      - `cupom_id` (uuid, FK to coupons) - Linked coupon
      - `plano_alvo_id` (uuid, FK to subscription_plans) - Target plan for upgrade
      - `url_destino` (text) - Destination URL on CTA click
      - `botao_texto` (text) - CTA button text
      - `botao_cor` (text) - CTA button color
      - `cor_fundo` (text) - Background color
      - `cor_texto` (text) - Text color
      - `cor_destaque` (text) - Accent/highlight color
      - `template` (text) - Display template: fullscreen, modal_central, banner_topo, slide_lateral
      - `prioridade` (int) - Priority order
      - `is_active` (boolean) - Whether offer is active
      - `data_inicio` (timestamptz) - Start date
      - `data_fim` (timestamptz) - End date
      - `parceiro_nome` (text) - Partner name (future use)
      - `parceiro_logo_url` (text) - Partner logo (future use)
      - `is_parceiro` (boolean) - Whether this is a partner offer
      - `tracking_params` (jsonb) - Partner tracking parameters
      - `created_by` (uuid, FK to users) - Admin who created
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `offer_targeting_rules` - Segmentation rules for automatic targeting
      - `id` (uuid, primary key)
      - `offer_id` (uuid, FK to promotional_offers)
      - `grupo_logico` (int) - Group number for AND/OR logic
      - `tipo_regra` (text) - Rule type: plan_status, dias_cadastro, qtd_produtos, billing_cycle, dias_ate_vencimento, atividade_recente, plano_especifico
      - `operador` (text) - Operator: igual, diferente, maior_que, menor_que, entre, contem
      - `valor` (text) - Primary value
      - `valor_secundario` (text) - Secondary value for "entre" operator
      - `created_at` (timestamptz)

    - `offer_user_assignments` - Manual offer assignments to users
      - `id` (uuid, primary key)
      - `offer_id` (uuid, FK to promotional_offers)
      - `user_id` (uuid, FK to users)
      - `assigned_by` (uuid, FK to users)
      - `assigned_at` (timestamptz)
      - `status` (text) - Status: pendente, visualizada, aceita, dispensada, expirada
      - `status_updated_at` (timestamptz)
      - `notes` (text)

    - `offer_impressions` - Tracking/analytics for offer interactions
      - `id` (uuid, primary key)
      - `offer_id` (uuid, FK to promotional_offers)
      - `user_id` (uuid, FK to users)
      - `action` (text) - Action: exibida, clicada, fechada, convertida
      - `session_context` (jsonb) - Page, time on page, etc.
      - `created_at` (timestamptz)

    - `offer_display_config` - Display frequency/trigger configuration
      - `id` (uuid, primary key)
      - `offer_id` (uuid, FK to promotional_offers)
      - `max_exibicoes_por_usuario` (int) - Max displays per user
      - `intervalo_horas_entre_exibicoes` (int) - Hours between displays
      - `exibir_apos_minutos_navegando` (int) - Minutes before showing
      - `gatilho_acao` (text) - Trigger: ao_entrar, apos_cadastrar_produto, apos_atingir_limite, ao_navegar_planos, manual_apenas
      - `horario_inicio_exibicao` (time) - Display start time
      - `horario_fim_exibicao` (time) - Display end time

  2. Security
    - RLS enabled on all tables
    - Admin full access policies
    - Users can only read their own assignments and active offers
    - Impression tracking allowed for authenticated users on their own data

  3. Indexes
    - offer_user_assignments(user_id, status) for fast user lookups
    - offer_targeting_rules(offer_id) for rule evaluation
    - offer_impressions(user_id, offer_id) for frequency checks
    - promotional_offers(is_active, data_inicio, data_fim) for active offer queries
*/

-- Promotional Offers main table
CREATE TABLE IF NOT EXISTS promotional_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  subtitulo text DEFAULT '',
  descricao text DEFAULT '',
  tipo_oferta text NOT NULL DEFAULT 'upgrade' CHECK (tipo_oferta IN ('upgrade', 'renovacao', 'parceiro', 'desconto_geral')),
  imagem_url text DEFAULT '',
  desconto_percentual numeric DEFAULT 0,
  desconto_valor_fixo numeric DEFAULT 0,
  cupom_id uuid,
  plano_alvo_id uuid,
  url_destino text DEFAULT '',
  botao_texto text DEFAULT 'Aproveitar Oferta',
  botao_cor text DEFAULT '#10b981',
  cor_fundo text DEFAULT '#ffffff',
  cor_texto text DEFAULT '#1f2937',
  cor_destaque text DEFAULT '#10b981',
  template text NOT NULL DEFAULT 'modal_central' CHECK (template IN ('fullscreen', 'modal_central', 'banner_topo', 'slide_lateral')),
  prioridade int DEFAULT 0,
  is_active boolean DEFAULT false,
  data_inicio timestamptz DEFAULT now(),
  data_fim timestamptz,
  parceiro_nome text,
  parceiro_logo_url text,
  is_parceiro boolean DEFAULT false,
  tracking_params jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE promotional_offers ENABLE ROW LEVEL SECURITY;

-- Offer Targeting Rules table
CREATE TABLE IF NOT EXISTS offer_targeting_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES promotional_offers(id) ON DELETE CASCADE,
  grupo_logico int NOT NULL DEFAULT 1,
  tipo_regra text NOT NULL CHECK (tipo_regra IN ('plan_status', 'dias_cadastro', 'qtd_produtos', 'billing_cycle', 'dias_ate_vencimento', 'atividade_recente', 'plano_especifico')),
  operador text NOT NULL DEFAULT 'igual' CHECK (operador IN ('igual', 'diferente', 'maior_que', 'menor_que', 'entre', 'contem')),
  valor text NOT NULL DEFAULT '',
  valor_secundario text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE offer_targeting_rules ENABLE ROW LEVEL SECURITY;

-- Offer User Assignments table
CREATE TABLE IF NOT EXISTS offer_user_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES promotional_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'visualizada', 'aceita', 'dispensada', 'expirada')),
  status_updated_at timestamptz DEFAULT now(),
  notes text DEFAULT ''
);

ALTER TABLE offer_user_assignments ENABLE ROW LEVEL SECURITY;

-- Offer Impressions table (analytics)
CREATE TABLE IF NOT EXISTS offer_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES promotional_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('exibida', 'clicada', 'fechada', 'convertida')),
  session_context jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE offer_impressions ENABLE ROW LEVEL SECURITY;

-- Offer Display Config table
CREATE TABLE IF NOT EXISTS offer_display_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES promotional_offers(id) ON DELETE CASCADE,
  max_exibicoes_por_usuario int DEFAULT 3,
  intervalo_horas_entre_exibicoes int DEFAULT 24,
  exibir_apos_minutos_navegando int DEFAULT 0,
  gatilho_acao text NOT NULL DEFAULT 'ao_entrar' CHECK (gatilho_acao IN ('ao_entrar', 'apos_cadastrar_produto', 'apos_atingir_limite', 'ao_navegar_planos', 'manual_apenas')),
  horario_inicio_exibicao time DEFAULT '00:00',
  horario_fim_exibicao time DEFAULT '23:59'
);

ALTER TABLE offer_display_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotional_offers
CREATE POLICY "Admins can manage all offers"
  ON promotional_offers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view active offers"
  ON promotional_offers FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (data_inicio IS NULL OR data_inicio <= now())
    AND (data_fim IS NULL OR data_fim >= now())
  );

-- RLS Policies for offer_targeting_rules
CREATE POLICY "Admins can manage targeting rules"
  ON offer_targeting_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view targeting rules of active offers"
  ON offer_targeting_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM promotional_offers
      WHERE promotional_offers.id = offer_targeting_rules.offer_id
      AND promotional_offers.is_active = true
    )
  );

-- RLS Policies for offer_user_assignments
CREATE POLICY "Admins can manage all assignments"
  ON offer_user_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view own assignments"
  ON offer_user_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own assignment status"
  ON offer_user_assignments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for offer_impressions
CREATE POLICY "Admins can view all impressions"
  ON offer_impressions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own impressions"
  ON offer_impressions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own impressions"
  ON offer_impressions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for offer_display_config
CREATE POLICY "Admins can manage display configs"
  ON offer_display_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can view display configs of active offers"
  ON offer_display_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM promotional_offers
      WHERE promotional_offers.id = offer_display_config.offer_id
      AND promotional_offers.is_active = true
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offer_user_assignments_user_status
  ON offer_user_assignments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_offer_targeting_rules_offer
  ON offer_targeting_rules(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_impressions_user_offer
  ON offer_impressions(user_id, offer_id);

CREATE INDEX IF NOT EXISTS idx_promotional_offers_active_dates
  ON promotional_offers(is_active, data_inicio, data_fim);

CREATE INDEX IF NOT EXISTS idx_offer_impressions_created
  ON offer_impressions(created_at);

-- Updated_at trigger for promotional_offers
CREATE OR REPLACE FUNCTION update_promotional_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_promotional_offers_updated_at ON promotional_offers;
CREATE TRIGGER set_promotional_offers_updated_at
  BEFORE UPDATE ON promotional_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_promotional_offers_updated_at();
