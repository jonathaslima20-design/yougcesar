/*
  # Add affiliate_teaser_hidden flag to users

  1. Modified Tables
    - `users`
      - `affiliate_teaser_hidden` (boolean, default false) - Admin-controlled
        blacklist flag. When true, the pulsing "Afiliados" teaser (menu badge
        + promotional modal with WhatsApp CTA) shown to merchants who don't
        yet have `affiliate_program_enabled` is suppressed entirely for this
        user. Has no effect once `affiliate_program_enabled` is true, since
        the teaser never shows for merchants who already have the module.

  2. Important Notes
    - Default is false: the teaser is shown to all eligible merchants unless
      explicitly blacklisted.
    - Toggled from the admin panel's user detail page (UserDetailPage.tsx).
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS affiliate_teaser_hidden boolean NOT NULL DEFAULT false;
