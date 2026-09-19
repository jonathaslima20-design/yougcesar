/*
  # Add cashback_enabled flag to users

  1. Modified Tables
    - `users`
      - `cashback_enabled` (boolean, default false) - Admin-controlled gate
        that determines whether this merchant can configure and offer
        cashback at checkout. When false, the "Cashback" settings card is
        hidden entirely on the merchant's checkout settings page, and
        buyers never see or accrue cashback for this store — regardless of
        what the merchant previously saved in settings.checkout.cashback.

  2. Important Notes
    - Default is false: rollout is admin-controlled per merchant, mirroring
      insurance_enabled and shipping_test_override.
    - Toggled from the admin panel's user detail page (UserDetailPage.tsx).
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cashback_enabled boolean NOT NULL DEFAULT false;
