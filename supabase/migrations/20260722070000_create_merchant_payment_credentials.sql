/*
  # Create merchant_payment_credentials table

  1. New Tables
    - `merchant_payment_credentials`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users, unique per provider) - the merchant who owns these credentials
      - `provider` (text, default 'mercadopago')
      - `environment` (text, 'test' or 'production')
      - `public_key` (text)
      - `access_token` (text)
      - `webhook_secret` (text)
      - `mp_account_id` (text) - populated by testCredentials
      - `mp_account_email` (text)
      - `is_active` (boolean) - doubles as "online payment enabled for this store"
      - `last_validated_at` (timestamptz)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - No client-side policies at all (mirrors mercadopago_config): the merchant
      never receives their raw access_token back unmasked, so there's no
      legitimate case for a direct client select(). All access goes through
      the merchant-payment-settings edge function (service role), which
      authenticates the caller as auth.uid() = user_id.

  3. Notes
    - is_active can only be set true when webhook_secret is non-empty
      (enforced in the edge function, not a DB constraint, since the edge
      function also needs to check the store's currency is BRL)
*/

CREATE TABLE IF NOT EXISTS merchant_payment_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('test','production')),
  public_key text NOT NULL DEFAULT '',
  access_token text NOT NULL DEFAULT '',
  webhook_secret text NOT NULL DEFAULT '',
  mp_account_id text DEFAULT '',
  mp_account_email text DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_payment_credentials_user_provider_key UNIQUE (user_id, provider)
);

ALTER TABLE merchant_payment_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (via merchant-payment-settings /
-- merchant-payments edge functions) can read or write this table.

CREATE OR REPLACE FUNCTION update_merchant_payment_credentials_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_merchant_payment_credentials_updated_at ON merchant_payment_credentials;
CREATE TRIGGER trigger_merchant_payment_credentials_updated_at
  BEFORE UPDATE ON merchant_payment_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_payment_credentials_updated_at();
