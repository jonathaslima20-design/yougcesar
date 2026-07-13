/*
  # Create Mercado Pago Payment System

  1. New Tables
    - `mercadopago_config`
      - `id` (uuid, primary key)
      - `environment` (text, 'test' or 'production')
      - `public_key_test` (text)
      - `access_token_test` (text)
      - `public_key_prod` (text)
      - `access_token_prod` (text)
      - `webhook_secret` (text)
      - `notification_url` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `mp_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users)
      - `plan_id` (uuid, FK to subscription_plans)
      - `billing_cycle` (text)
      - `amount_cents` (integer)
      - `currency` (text, default 'BRL')
      - `payment_method` (text, 'pix' or 'credit_card')
      - `mp_payment_id` (text, unique)
      - `status` (text, default 'pending')
      - `status_detail` (text)
      - `payer_email` (text)
      - `payer_doc` (text)
      - `pix_qr_code` (text)
      - `pix_qr_code_base64` (text)
      - `pix_ticket_url` (text)
      - `pix_expires_at` (timestamptz)
      - `installments` (integer, default 1)
      - `card_last4` (text)
      - `card_brand` (text)
      - `environment` (text, default 'test')
      - `raw_response` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `payment_webhook_events`
      - `id` (uuid, primary key)
      - `mp_event_id` (text, unique)
      - `event_type` (text)
      - `mp_payment_id` (text)
      - `payload` (jsonb)
      - `processed` (boolean)
      - `received_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - `mercadopago_config`: no public access (service_role only)
    - `mp_payments`: authenticated users can read their own payments
    - `payment_webhook_events`: no public access (service_role only)

  3. Indexes
    - Unique index on mp_payments.mp_payment_id
    - Index on mp_payments.user_id
    - Index on mp_payments.status
    - Index on payment_webhook_events.mp_payment_id
*/

-- Mercado Pago Configuration Table (single active row)
CREATE TABLE IF NOT EXISTS mercadopago_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'test',
  public_key_test text DEFAULT '',
  access_token_test text DEFAULT '',
  public_key_prod text DEFAULT '',
  access_token_prod text DEFAULT '',
  webhook_secret text DEFAULT '',
  notification_url text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mercadopago_config ENABLE ROW LEVEL SECURITY;

-- Payments Table
CREATE TABLE IF NOT EXISTS mp_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  plan_id uuid REFERENCES subscription_plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly',
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  payment_method text NOT NULL DEFAULT 'pix',
  mp_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  status_detail text DEFAULT '',
  payer_email text DEFAULT '',
  payer_doc text DEFAULT '',
  pix_qr_code text DEFAULT '',
  pix_qr_code_base64 text DEFAULT '',
  pix_ticket_url text DEFAULT '',
  pix_expires_at timestamptz,
  installments integer DEFAULT 1,
  card_last4 text DEFAULT '',
  card_brand text DEFAULT '',
  environment text NOT NULL DEFAULT 'test',
  raw_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mp_payments ENABLE ROW LEVEL SECURITY;

-- Webhook Events Table (idempotency + audit)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_id text UNIQUE NOT NULL,
  event_type text DEFAULT '',
  mp_payment_id text DEFAULT '',
  payload jsonb DEFAULT '{}'::jsonb,
  processed boolean DEFAULT false,
  received_at timestamptz DEFAULT now()
);

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS mp_payments_mp_payment_id_uniq
  ON mp_payments (mp_payment_id) WHERE mp_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mp_payments_user_id_idx ON mp_payments (user_id);
CREATE INDEX IF NOT EXISTS mp_payments_status_idx ON mp_payments (status);
CREATE INDEX IF NOT EXISTS payment_webhook_events_payment_id_idx ON payment_webhook_events (mp_payment_id);

-- RLS Policies

-- mercadopago_config: no public access at all (only service_role can read/write)
-- No policies needed since RLS is enabled and blocks all access by default

-- mp_payments: users can read their own payments
CREATE POLICY "Users can view own payments"
  ON mp_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- mp_payments: users can insert their own payments (via Edge Function with service_role, but allow direct too)
CREATE POLICY "Users can create own payments"
  ON mp_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- payment_webhook_events: no public access (only service_role)
-- No policies needed since RLS is enabled and blocks all access by default
