/*
  # Add separate test/production credential pairs to merchant_payment_credentials

  1. Changes
    - Add `public_key_test`, `access_token_test`, `public_key_prod`, `access_token_prod`
      (text, default '') to `merchant_payment_credentials` — mirrors the columns
      `mercadopago_config` (the platform admin's own Mercado Pago config table) already
      uses, so a merchant can keep both a sandbox and a production credential pair saved
      at the same time and just flip `environment` to pick which one is live, instead of
      overwriting the single pair every time they switch.
    - Backfill: existing single-pair rows get their `public_key`/`access_token` copied into
      whichever pair matches their current `environment` value.

  2. Notes
    - The old `public_key`/`access_token` columns are intentionally left in place (not
      dropped) — merchants apply migrations manually and edge functions are deployed
      separately, so keeping the old columns avoids any window where a not-yet-updated
      function reading the old columns (or a not-yet-deployed function expecting the new
      ones) breaks payment processing. Cleanup is a separate future migration once the new
      columns have been live for a while.
*/

ALTER TABLE merchant_payment_credentials
  ADD COLUMN IF NOT EXISTS public_key_test text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_token_test text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_key_prod text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS access_token_prod text NOT NULL DEFAULT '';

UPDATE merchant_payment_credentials
SET
  public_key_test = CASE WHEN environment = 'test' THEN public_key ELSE public_key_test END,
  access_token_test = CASE WHEN environment = 'test' THEN access_token ELSE access_token_test END,
  public_key_prod = CASE WHEN environment = 'production' THEN public_key ELSE public_key_prod END,
  access_token_prod = CASE WHEN environment = 'production' THEN access_token ELSE access_token_prod END
WHERE public_key <> '' OR access_token <> '';
