/*
  # Create merchant_erp_credentials table

  1. New Tables
    - `merchant_erp_credentials`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to users, unique per provider) - the merchant who owns these credentials
      - `provider` (text, default 'olist') - only 'olist' (Olist ERP, formerly Tiny) for now
      - `client_id` / `client_secret` (text) - OAuth2 app credentials the merchant generates
        themselves inside their own Olist ERP account (Configurações > Aplicativos). Unlike
        Mercado Pago, VitrineTurbo does not have a single platform-wide OAuth app here — every
        merchant registers their own, so these are per-merchant, not platform secrets.
      - `access_token` / `refresh_token` (text, nullable) - issued by
        accounts.tiny.com.br after the merchant completes the authorize redirect; null until
        the merchant finishes connecting.
      - `token_expires_at` (timestamptz, nullable) - drives refresh-before-use logic in the
        edge functions; Olist access tokens are short-lived like standard OAuth2.
      - `oauth_state` (text, nullable) - single-use CSRF token generated when the merchant
        starts the authorize redirect, checked (and cleared) on callback.
      - `is_active` (boolean) - whether sync jobs should treat this connection as live.
      - `last_synced_at` (timestamptz, nullable)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - No client-side policies (mirrors merchant_shipping_credentials /
      merchant_payment_credentials): client_secret/access_token/refresh_token are live
      credentials with no legitimate case for a direct client select(). All access goes
      through the merchant-erp-settings / merchant-erp-sync edge functions (service role).

  3. Notes
    - provider only allows 'olist' for now; a follow-up migration will extend the CHECK
      constraint if a second ERP (Bling, generic Tiny-branded accounts, etc.) is added.
*/

CREATE TABLE IF NOT EXISTS merchant_erp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'olist' CHECK (provider IN ('olist')),
  client_id text NOT NULL DEFAULT '',
  client_secret text NOT NULL DEFAULT '',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  oauth_state text,
  is_active boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merchant_erp_credentials_user_provider_key UNIQUE (user_id, provider)
);

ALTER TABLE merchant_erp_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (via merchant-erp-settings / merchant-erp-sync
-- edge functions) can read or write this table.

CREATE OR REPLACE FUNCTION update_merchant_erp_credentials_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_merchant_erp_credentials_updated_at ON merchant_erp_credentials;
CREATE TRIGGER trigger_merchant_erp_credentials_updated_at
  BEFORE UPDATE ON merchant_erp_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_erp_credentials_updated_at();
