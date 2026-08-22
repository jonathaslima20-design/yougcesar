/*
  # Flip affiliate_teaser_hidden default to true

  1. Problem
    - `affiliate_teaser_hidden` defaulted to false, so the pulsing "Afiliados"
      teaser (menu badge + promotional modal with WhatsApp CTA) was shown to
      every merchant without `affiliate_program_enabled` unless an admin
      explicitly blacklisted them one by one.
    - Desired behavior is the opposite: the teaser should be off by default,
      and only shown to merchants an admin deliberately opts in.

  2. Fix
    - Change the column default to true for any future user row.
    - Backfill every existing user where affiliate_program_enabled = false
      (the only ones the teaser could ever show to) to affiliate_teaser_hidden
      = true, so the flip takes effect immediately instead of only for new
      signups.
    - Rows with affiliate_program_enabled = true are left untouched — the
      teaser never shows for them regardless of this flag.

  3. Important Notes
    - This is a one-way default flip, not a new admin control: the existing
      "Ocultar oferta de afiliados" switch in UserDetailPage.tsx still works
      exactly as before, just starting from the opposite default state.
*/

ALTER TABLE public.users ALTER COLUMN affiliate_teaser_hidden SET DEFAULT true;

UPDATE public.users
SET affiliate_teaser_hidden = true
WHERE affiliate_program_enabled = false
  AND affiliate_teaser_hidden = false;
