/*
  # Add OAuth fields to merchant_payment_credentials

  ## Summary
  Merchants previously pasted their own Mercado Pago Public Key/Access Token
  directly. That model cannot support the platform's split-payment fee
  (`application_fee` requires an OAuth-obtained access token — see
  mercadopago_marketplace_config). This migration adds the columns needed to
  store the result of the OAuth "Conectar com Mercado Pago" flow, reusing the
  existing `access_token_test/prod` and `public_key_test/prod` columns to
  hold the OAuth-issued token/key for whichever `environment` is active.

  ## Changes
    - `refresh_token` (text, nullable) - used to renew the access_token
      before its 180-day expiry (see the refresh-merchant-mp-tokens cron)
    - `token_expires_at` (timestamptz, nullable)
    - `mp_user_id` (text, nullable) - the seller's MP user id returned by
      the OAuth token exchange; informational only, payments are created
      using the access_token directly (MP has no collector_id field)
    - `oauth_state` (text, nullable) - CSRF state for the authorize/callback
      round trip, same pattern as `merchant_erp_credentials.oauth_state`

  ## Notes
  A row without `refresh_token` means the merchant never completed OAuth
  (either never connected, or is a leftover from the old paste-your-own-key
  model) — createPixPayment/createCardPayment require refresh_token to be
  present before creating a payment, so old manually-pasted credentials stop
  being usable automatically, with no data backfill needed.
*/

ALTER TABLE merchant_payment_credentials
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp_user_id text,
  ADD COLUMN IF NOT EXISTS oauth_state text;
