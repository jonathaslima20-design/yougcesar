/*
  # Referral System Enhancement - Click Tracking and Settings Update

  1. New Tables
    - `referral_clicks`
      - `id` (uuid, primary key)
      - `referral_code` (text, not null) - the referral code clicked
      - `referrer_id` (uuid, FK to users) - who owns the referral code
      - `visitor_id` (text) - anonymous fingerprint to avoid duplicate counts
      - `created_at` (timestamptz)

  2. Modified Tables
    - `referral_settings`: Add `commission_trimestral` column (numeric, default 50.00)

  3. Security
    - Enable RLS on `referral_clicks`
    - Policies for insert (anon + authenticated) and select (owner only)

  4. New Legal Document
    - Insert initial "Termos e Condições do Programa de Indicações" into legal_documents

  5. Index
    - Index on referral_clicks(referral_code) for fast count queries
    - Index on referral_clicks(referrer_id) for user-specific queries
*/

-- 1. Create referral_clicks table
CREATE TABLE IF NOT EXISTS referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL,
  referrer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  visitor_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referral_code ON referral_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer_id ON referral_clicks(referrer_id);

-- Enable RLS
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert clicks (visitors are anonymous)
CREATE POLICY "Anyone can register referral clicks"
  ON referral_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only the referrer can view their own click data
CREATE POLICY "Referrers can view own click data"
  ON referral_clicks FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

-- 2. Add commission_trimestral to referral_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_settings' AND column_name = 'commission_trimestral'
  ) THEN
    ALTER TABLE referral_settings ADD COLUMN commission_trimestral numeric NOT NULL DEFAULT 50.00;
  END IF;
END $$;

-- Update existing settings row with trimestral value
UPDATE referral_settings SET commission_trimestral = 50.00 WHERE commission_trimestral IS NULL OR commission_trimestral = 0;

-- 3. Insert referral terms legal document
INSERT INTO legal_documents (document_type, title, version, content, is_active)
SELECT 
  'referral_terms',
  'Termos e Condições do Programa de Indicações',
  '1.0',
  E'# Termos e Condições do Programa de Indicações - VitrineTurbo\n\n## 1. Elegibilidade\n\nO Programa de Indicações (\"Indique e Ganhe\") está disponível exclusivamente para usuários que possuem um plano ativo (Trimestral, Semestral ou Anual) na plataforma VitrineTurbo.\n\n## 2. Como Funciona\n\n- Cada usuário elegível recebe um link de indicação único.\n- Quando um novo usuário se cadastra através desse link e ativa um plano pago, o indicador recebe uma comissão.\n- O link de indicação direciona o visitante para a página principal do VitrineTurbo.\n\n## 3. Comissões\n\nOs valores de comissão são determinados pelo plano ativado pelo indicado:\n\n| Plano do Indicado | Comissão do Indicador |\n|---|---|\n| Trimestral | R$ 50,00 |\n| Semestral | R$ 70,00 |\n| Anual | R$ 100,00 |\n\nOs valores podem ser alterados a qualquer momento pela administração do VitrineTurbo.\n\n## 4. Pagamento\n\n- As comissões ficam disponíveis para saque após a confirmação do pagamento do indicado.\n- O valor mínimo para solicitar saque é de R$ 50,00.\n- Saques são processados via PIX em até 5 dias úteis.\n- O usuário deve cadastrar uma chave PIX válida para receber pagamentos.\n\n## 5. Regras e Restrições\n\n- Auto-indicação não é permitida (indicar a si mesmo ou contas próprias).\n- Indicações fraudulentas (contas falsas, spam, etc.) resultarão em cancelamento das comissões e possível suspensão da conta.\n- Cada indicado gera comissão apenas na primeira ativação de plano pago.\n- O programa pode ser suspenso ou encerrado a qualquer momento.\n\n## 6. Responsabilidades\n\n- O indicador é responsável por compartilhar seu link de forma ética e respeitosa.\n- O VitrineTurbo não se responsabiliza por links compartilhados em contextos inapropriados.\n\n## 7. Alterações\n\nEstes termos podem ser atualizados a qualquer momento. Usuários serão notificados sobre alterações significativas.\n\n---\n\n*Última atualização: Maio de 2026*',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM legal_documents WHERE document_type = 'referral_terms' AND is_active = true
);

-- 4. Drop the unique constraint on referred_user_id to allow multiple commissions per user
-- (e.g., when they renew or change plans)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'referral_commissions_referred_user_id_key'
  ) THEN
    ALTER TABLE referral_commissions DROP CONSTRAINT IF EXISTS referral_commissions_referred_user_id_key;
  END IF;
END $$;
