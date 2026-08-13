/*
  # Add store_zip_code to users (merchant's own store CEP)

  1. Modified Tables
    - `users`
      - `store_zip_code` (text, nullable) - the merchant's own CEP. Resolved
        via ViaCEP in the dashboard the same way buyer addresses are, and used
        to auto-fill `city`/`state` on save. Distinct from
        `merchant_shipping_credentials.origin_zip_code`, which is scoped to
        the SuperFrete integration and has no client SELECT policy — this
        column is a general-purpose profile field.

  2. Notes
    - `city`/`state` (added in 20260803110000_add_city_state_to_users.sql)
      remain the only columns actually read by the local-delivery match logic
      (CartModal.tsx, CheckoutAddressPage.tsx). This migration does not change
      that read path — the CEP is an additional input that the Settings UI
      writes through to `city`/`state` on save, so no existing read site needs
      to change.
    - Nullable, no default, no FK, no CHECK constraint — same free-text
      profile-field convention as `city`/`state`, enforced at the application
      layer, not the database layer.
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS store_zip_code text;
