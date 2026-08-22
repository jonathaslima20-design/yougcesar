/*
  # Add shipping_test_override flag to users

  1. Modified Tables
    - `users`
      - `shipping_test_override` (boolean, default false) - Admin-controlled
        gate that releases the shipping carrier integrations section
        ("Transportadoras", e.g. SuperFrete) in the merchant's Frete settings
        tab for this specific user, regardless of platform-wide rollout
        state. Mirrors `payments_test_override`: lets a merchant validate
        real carrier quotes/labels in production while the feature stays
        hidden for everyone else.

  2. Important Notes
    - Default is false: rollout is admin-controlled per merchant, same
      pattern as payments_test_override and insurance_enabled.
    - Does NOT affect the core delivery options (local delivery, pickup,
      national flat rate) already live for all merchants — only the carrier
      integrations grid.
    - Toggled from the admin panel's user detail page (UserDetailPage.tsx).
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shipping_test_override boolean NOT NULL DEFAULT false;
