/*
  # Stripe admin config (mirrors mercadopago_config)

  Move Stripe credentials from Edge Function secrets into an admin-managed
  table, same pattern as mercadopago_config: RLS enabled, zero policies, so
  only service_role (used by the stripe-admin/stripe-checkout/stripe-webhook
  Edge Functions) can ever read or write it — no public/anon/authenticated
  access is possible, regardless of what the client sends.

  stripe_prices stores the 8 Price IDs (MXN/CLP/EUR/USD x monthly/annual)
  per environment, filled in by the admin from the output of
  scripts/setup-stripe-products.js. Not secret (Stripe Price IDs aren't
  sensitive), but kept server-side since stripe-checkout is the only reader.
*/

CREATE TABLE IF NOT EXISTS stripe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'production')),
  publishable_key_test text DEFAULT '',
  secret_key_test text DEFAULT '',
  publishable_key_prod text DEFAULT '',
  secret_key_prod text DEFAULT '',
  webhook_secret_test text DEFAULT '',
  webhook_secret_prod text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stripe_config ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only, same as mercadopago_config.

CREATE TABLE IF NOT EXISTS stripe_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'production')),
  currency text NOT NULL CHECK (currency IN ('MXN', 'CLP', 'EUR', 'USD')),
  cycle text NOT NULL CHECK (cycle IN ('monthly', 'annual')),
  price_id text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stripe_prices ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only.

CREATE UNIQUE INDEX IF NOT EXISTS stripe_prices_env_currency_cycle_key
  ON stripe_prices (environment, currency, cycle);
