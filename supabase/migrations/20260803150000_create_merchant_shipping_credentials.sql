/*
  # Create merchant_shipping_credentials table

  1. New Tables
    - `merchant_shipping_credentials`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users, unique per provider) - the merchant who owns these credentials
      - `provider` (text, default 'superfrete')
      - `environment` (text, 'sandbox' or 'production')
      - `api_token` (text) - secret Bearer token for the SuperFrete API
      - `origin_zip_code` (text) - the merchant's shipping-origin CEP, not secret,
        but only ever read/written server-side alongside the token for simplicity
      - `is_active` (boolean) - doubles as "automatic quoting enabled for this store"
      - `last_validated_at` (timestamptz)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - No client-side policies at all (mirrors merchant_payment_credentials): the
      merchant never receives their raw api_token back unmasked, so there's no
      legitimate case for a direct client select(). All access goes through the
      merchant-shipping-settings / merchant-shipping-quote edge functions
      (service role).

  3. Notes
    - Unlike merchant_payment_credentials, there is no platform-wide kill switch
      for this feature (shipping quotes carry no compliance concern the way
      payments do) — is_active is gated purely on the merchant having entered a
      validated token and origin CEP (enforced in merchant-shipping-settings,
      not a DB constraint).
    - provider only allows 'superfrete' for now; a follow-up migration will add
      'melhor_envio' to the CHECK constraint when that integration is built.
*/

CREATE TABLE IF NOT EXISTS merchant_shipping_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'superfrete' CHECK (provider IN ('superfrete')),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  api_token text NOT NULL DEFAULT '',
  origin_zip_code text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_shipping_credentials_user_provider_key UNIQUE (user_id, provider)
);

ALTER TABLE merchant_shipping_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (via merchant-shipping-settings /
-- merchant-shipping-quote edge functions) can read or write this table.

CREATE OR REPLACE FUNCTION update_merchant_shipping_credentials_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_merchant_shipping_credentials_updated_at ON merchant_shipping_credentials;
CREATE TRIGGER trigger_merchant_shipping_credentials_updated_at
  BEFORE UPDATE ON merchant_shipping_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_shipping_credentials_updated_at();
