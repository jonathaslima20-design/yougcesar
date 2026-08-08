/*
  # Add city/state to merchant profile

  1. Modified Tables
    - `users`
      - `city` (text, nullable) - merchant's own registered city, free text.
      - `state` (text, nullable) - merchant's own registered UF.

  2. Notes
    - These are the merchant's OWN location, distinct from any buyer/order
      shipping address. They are the reference point that lets the storefront
      determine whether a buyer is "local" (same city) for the new
      `DeliveryOption.scope === 'local'` feature — a merchant with no city set
      simply can't offer scope-restricted local delivery yet (enforced at the
      application layer, not by a NOT NULL constraint, since most existing
      merchants have never had a reason to fill this in).
    - Nullable with no default, following the same free-text profile field
      pattern as `bio`/`instagram`/`location_url` rather than the admin-gated
      boolean-flag pattern used by `insurance_enabled`.
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state text;
