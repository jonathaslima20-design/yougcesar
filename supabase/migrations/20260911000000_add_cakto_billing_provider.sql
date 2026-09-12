/*
  # Add Cakto as a third billing provider (Brazil, alongside Mercado Pago)

  Cakto replicates the same "cobrança avulsa por ciclo" model Mercado Pago
  already uses in this project (no native recurring subscription/Pix
  Automático — those require a Cakto Banking account this merchant doesn't
  have yet). check-expiring-subscriptions already treats any
  billing_provider != 'stripe' uniformly, so Cakto users need no cron
  changes: they just need to land in users/subscriptions with the same
  shape mp_payments's activatePlan() already produces.

  - cakto_config: singleton, RLS with zero policies (service_role only),
    same pattern as mercadopago_config/stripe_config. Holds both the
    server-side OAuth2 client credentials (client_id/secret, used against
    POST /public_api/token/) and the browser-safe SDK client_id (tokenização
    scope only, used by the Cakto JS SDK for card tokenization/antifraud).
    is_active is the BR routing switch (mercadopago vs cakto); pix_enabled
    stays false until Cakto Banking is confirmed active for this account —
    Pix charges 400 without it.
  - cakto_offers: maps (plan_id, billing_cycle) -> the Oferta id created
    manually in the Cakto dashboard, same role as stripe_prices.
  - cakto_payments: mirrors mp_payments's shape/RLS exactly, one row per
    payment attempt.
  - cakto_webhook_events: mirrors stripe_webhook_events, idempotency only.
*/

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'users'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%billing_provider%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE users ADD CONSTRAINT users_billing_provider_check
    CHECK (billing_provider IN ('mercadopago', 'stripe', 'cakto'));
END $$;

CREATE TABLE IF NOT EXISTS cakto_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'production',
  client_id_test text DEFAULT '',
  client_secret_test text DEFAULT '',
  client_id_prod text DEFAULT '',
  client_secret_prod text DEFAULT '',
  sdk_client_id_test text DEFAULT '',
  sdk_client_id_prod text DEFAULT '',
  webhook_secret text DEFAULT '',
  pix_enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cakto_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cakto_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'production',
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  billing_cycle text NOT NULL,
  product_id text NOT NULL DEFAULT '',
  offer_id text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (environment, plan_id, billing_cycle)
);

ALTER TABLE cakto_offers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cakto_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  plan_id uuid REFERENCES subscription_plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly',
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  payment_method text NOT NULL DEFAULT 'pix',
  cakto_order_id text,
  status text NOT NULL DEFAULT 'pending',
  status_detail text DEFAULT '',
  payer_email text DEFAULT '',
  payer_doc text DEFAULT '',
  pix_qr_code text DEFAULT '',
  pix_expires_at timestamptz,
  installments integer DEFAULT 1,
  card_last4 text DEFAULT '',
  card_brand text DEFAULT '',
  environment text NOT NULL DEFAULT 'production',
  early_renewal boolean NOT NULL DEFAULT false,
  offer_id uuid REFERENCES promotional_offers(id) ON DELETE SET NULL,
  coupon_id uuid,
  discount_cents integer DEFAULT 0,
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cakto_payments ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS cakto_payments_order_id_uniq
  ON cakto_payments (cakto_order_id) WHERE cakto_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cakto_payments_user_id_idx ON cakto_payments (user_id);
CREATE INDEX IF NOT EXISTS cakto_payments_status_idx ON cakto_payments (status);
CREATE INDEX IF NOT EXISTS cakto_payments_offer_id_idx ON cakto_payments (offer_id);

CREATE POLICY "Users can view own cakto payments"
  ON cakto_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cakto payments"
  ON cakto_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS cakto_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cakto_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL DEFAULT '',
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cakto_webhook_events ENABLE ROW LEVEL SECURITY;
