/*
  # Add Stripe billing fields (international expansion, Fase 1)

  Aditivo apenas. Todo usuário existente continua classificado como
  billing_provider='mercadopago', country='BR', currency='BRL' — nenhum
  comportamento do fluxo Mercado Pago muda.

  - billing_provider: qual provedor de cobrança processa a assinatura do usuário
  - country: país ISO-3166 usado para roteamento de billing/preço — NÃO é o
    DDI de WhatsApp (esse já existe em users.country_code, ex. '55', '1')
  - billing_currency: moeda da assinatura (BRL para provider='mercadopago', a
    moeda do país para provider='stripe') — NÃO é users.currency, que já
    existe e é a moeda de EXIBIÇÃO da vitrine do lojista (editável em
    ProfileSettings), sem relação com billing
  - stripe_customer_id / stripe_subscription_id: preenchidos só quando
    billing_provider='stripe'

  stripe_webhook_events existe só para idempotência do webhook Stripe —
  tabela própria, não reaproveita payment_webhook_events (que é específica
  do formato de evento do Mercado Pago), mantendo os dois provedores
  desacoplados (mesmo padrão de activatePlan() duplicada entre
  mercadopago/index.ts e mp-webhook/index.ts).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'billing_provider'
  ) THEN
    ALTER TABLE users ADD COLUMN billing_provider text NOT NULL DEFAULT 'mercadopago'
      CHECK (billing_provider IN ('mercadopago', 'stripe'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'country'
  ) THEN
    ALTER TABLE users ADD COLUMN country text NOT NULL DEFAULT 'BR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'billing_currency'
  ) THEN
    ALTER TABLE users ADD COLUMN billing_currency text NOT NULL DEFAULT 'BRL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE users ADD COLUMN stripe_subscription_id text;
  END IF;
END $$;

COMMENT ON COLUMN users.country IS 'ISO-3166 country for billing/geo routing — NOT the WhatsApp DDI (see country_code)';
COMMENT ON COLUMN users.billing_currency IS 'Currency the subscription is billed in — NOT users.currency (storefront display currency, unrelated)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'users_stripe_subscription_id_key'
  ) THEN
    CREATE UNIQUE INDEX users_stripe_subscription_id_key
      ON users (stripe_subscription_id)
      WHERE stripe_subscription_id IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
