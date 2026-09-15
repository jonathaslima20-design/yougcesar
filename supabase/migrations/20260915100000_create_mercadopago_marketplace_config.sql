/*
  # Create mercadopago_marketplace_config (platform fee / split payments)

  ## Summary
  Singleton config for the Mercado Pago "Application" (Marketplace/OAuth)
  that VitrineTurbo itself registers with Mercado Pago, used to let merchants
  connect their own MP account via OAuth ("Conectar com Mercado Pago") so
  that createPixPayment/createCardPayment can send `application_fee` on
  every sale — the platform's 1% commission, deposited automatically into
  VitrineTurbo's own MP account at payment time. This is separate from
  `mercadopago_config` (VitrineTurbo's own MP account used to collect the
  merchant's SaaS subscription) — different concern entirely.

  ## New Tables
  - `mercadopago_marketplace_config`
    - `id` (int, primary key, always 1 - singleton row pattern, same as
      `platform_payment_settings`)
    - `client_id` / `client_secret` - the registered MP Application's OAuth
      credentials (obtained manually by the owner in the MP Developers panel)
    - `environment` ('test' | 'production')
    - `webhook_secret` - the Application-level x-signature secret (MP
      generates this per Application, not per connected seller anymore)
    - `fee_percentage` (numeric, default 1.00) - platform commission, as a
      percentage of the sale, admin-editable without a redeploy
    - `redirect_uri` - stored for display in the admin UI (must match
      exactly what's registered in the MP Application's OAuth settings)
    - `updated_at`

  ## Security
  - RLS enabled, no client policies at all (mirrors `mercadopago_config`):
    client_secret/webhook_secret must never reach the browser. All access
    goes through service-role edge functions (mercadopago-marketplace-admin
    for admin read/write, merchant-payment-settings/merchant-payments/
    merchant-payment-webhook for read-only use during OAuth/checkout).
*/

CREATE TABLE IF NOT EXISTS mercadopago_marketplace_config (
  id integer PRIMARY KEY DEFAULT 1,
  client_id text NOT NULL DEFAULT '',
  client_secret text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'production')),
  webhook_secret text NOT NULL DEFAULT '',
  fee_percentage numeric NOT NULL DEFAULT 1.00,
  redirect_uri text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mercadopago_marketplace_config_singleton CHECK (id = 1)
);

ALTER TABLE mercadopago_marketplace_config ENABLE ROW LEVEL SECURITY;

INSERT INTO mercadopago_marketplace_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
