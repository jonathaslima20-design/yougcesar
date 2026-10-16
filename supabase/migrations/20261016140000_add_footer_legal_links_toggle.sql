/*
  # Admin toggle: show/hide legal links in the storefront footer

  1. Problem
    - The platform footer shown on every storefront (Footer.tsx) always
      renders "Privacidade / Cookies / Termos de Uso" links pointing to
      VitrineTurbo's own legal pages. There was no way for an admin to turn
      these off platform-wide.

  2. Change
    - Seed a new `site_settings` row (`show_footer_legal_links`, default
      'true' — current behavior is unchanged until an admin flips it) that
      Footer.tsx reads to decide whether to render those links.
    - `site_settings` already has RLS enabled (see
      20260809100000_fix_rls_disabled_tables.sql) and a working public SELECT
      policy (verified live), but no INSERT/UPDATE policy was ever tracked in
      migrations — existing rows (global_meta_pixel_id etc.) were set by hand
      in the Supabase dashboard. Add admin-only INSERT/UPDATE policies, same
      shape as system_storefront_appearance's, so the new admin UI can write
      to this table through the normal authenticated client.
*/

INSERT INTO site_settings (setting_name, setting_value)
SELECT 'show_footer_legal_links', 'true'
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings WHERE setting_name = 'show_footer_legal_links'
);

DROP POLICY IF EXISTS "Admins can insert site settings" ON site_settings;
CREATE POLICY "Admins can insert site settings"
  ON site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update site settings" ON site_settings;
CREATE POLICY "Admins can update site settings"
  ON site_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
