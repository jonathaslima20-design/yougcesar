/*
  # Make the footer legal-links toggle per-merchant instead of global

  1. Problem
    - 20261016140000_add_footer_legal_links_toggle.sql added a single
      platform-wide switch (site_settings.show_footer_legal_links) controlled
      from Central Legal (/admin/legal). That was the wrong shape: the owner
      wants this alongside the other per-merchant admin toggles already on
      UserDetailPage (Pagamento online, Programa de afiliados, Seguro de
      frete), so one store can have it off without affecting every other
      store on the platform.

  2. Change
    - Add `show_footer_legal_links` directly to `users`, same pattern as
      `insurance_enabled`/`affiliate_program_enabled`: a plain boolean column,
      defaulting to true (current/original behavior — every existing store
      keeps showing the links until an admin turns this off for it
      specifically).
    - The site_settings row/policies from the previous migration are left in
      place (harmless, and the INSERT/UPDATE admin policies are generically
      useful for future global settings) but are no longer read by the app.
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS show_footer_legal_links boolean NOT NULL DEFAULT true;
