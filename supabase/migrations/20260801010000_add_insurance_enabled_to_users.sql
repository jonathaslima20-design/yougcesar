/*
  # Add insurance_enabled flag to users

  1. Modified Tables
    - `users`
      - `insurance_enabled` (boolean, default false) - Admin-controlled gate
        that determines whether this merchant can configure and offer
        shipping insurance (seguro de frete) at checkout. When false, the
        "Seguro de Frete" settings card is hidden entirely on the merchant's
        checkout settings page, and buyers never see the insurance opt-in
        checkbox for this store's checkout — regardless of what the merchant
        previously saved in settings.checkout.shippingInsurance.

  2. Important Notes
    - Default is false: rollout is admin-controlled per merchant, mirroring
      payments_test_override and whatsapp_message_enabled.
    - Toggled from the admin panel's user detail page (UserDetailPage.tsx).
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS insurance_enabled boolean NOT NULL DEFAULT false;
