/*
  # Add affiliate_program_enabled flag to users

  1. Modified Tables
    - `users`
      - `affiliate_program_enabled` (boolean, default false) - Admin-controlled
        gate that determines whether this merchant can create/manage
        affiliates and offer the affiliate program on their storefront. When
        false, the "Afiliados" dashboard module is hidden entirely for the
        merchant, and `create_order_complete` refuses to attach an affiliate
        to any new order for this store regardless of what a buyer's browser
        has stored as attribution.

  2. Important Notes
    - Default is false: rollout is admin-controlled per merchant, mirroring
      insurance_enabled, payments_test_override and whatsapp_message_enabled.
    - Toggled from the admin panel's user detail page (UserDetailPage.tsx).
    - This is the first migration of the affiliate program feature. See also:
      affiliates, affiliate_commission_rules, affiliate_clicks,
      affiliate_commissions, and the orders.affiliate_id /
      create_order_complete changes in later migrations of this batch.
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS affiliate_program_enabled boolean NOT NULL DEFAULT false;
