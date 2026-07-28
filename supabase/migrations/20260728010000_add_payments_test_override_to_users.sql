/*
  # Per-user override for the platform-wide online payments kill switch

  1. Problem
    - `platform_payment_settings.online_payments_enabled` gates online
      payments for every store at once. That's correct for a feature still
      being built, but it also blocks finishing and testing the feature
      end-to-end, since there is no way to try it on a single real account
      while it stays off for everyone else.

  2. Changes
    - `users.payments_test_override`: boolean, defaults to false. When true
      for a given merchant, that merchant's dashboard, payment settings
      activation, and storefront checkout all behave as if online payments
      were enabled platform-wide — regardless of the global switch. Every
      other merchant is unaffected.
    - Admin-only field (same pattern as other admin-managed per-user flags).
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payments_test_override boolean NOT NULL DEFAULT false;
