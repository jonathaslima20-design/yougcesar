/*
  # Add label-purchase mode + sender data to merchant_shipping_credentials

  1. Changes
    - `merchant_shipping_credentials`
      - New column `label_purchase_enabled` (boolean, default false) - when
        on, the merchant can buy the SuperFrete shipping label and print it
        from the order panel, instead of only quoting freight at checkout.
      - New sender ("remetente") columns, required by SuperFrete's
        `/api/v0/cart` `from` object when generating a real label:
        `sender_name`, `sender_document`, `sender_phone`, `sender_street`,
        `sender_number`, `sender_complement`, `sender_neighborhood`,
        `sender_city`, `sender_state`.

  2. Notes
    - None of the new columns are secrets (unlike `api_token`), so no
      masking is needed when read back through merchant-shipping-settings.
    - `origin_zip_code` already exists and is reused as the sender's CEP;
      city/state are auto-filled client-side via ViaCEP but stored here so
      the label-purchase edge function has them without an extra lookup.
    - No new RLS policy needed: this table already has RLS enabled with no
      client policies (service-role only, via the shipping edge functions).
*/

ALTER TABLE merchant_shipping_credentials
  ADD COLUMN IF NOT EXISTS label_purchase_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sender_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_document text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_complement text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_neighborhood text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_state text NOT NULL DEFAULT '';
