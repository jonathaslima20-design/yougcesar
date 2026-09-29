/*
  # Create platform_theme_settings table (global theme visibility switch)

  ## Summary
  Platform-wide switch that lets an admin show or hide the "Eletrônicos"
  storefront theme for every merchant at once. Defaults to disabled: the theme
  is still being finished, and merchants must keep seeing only the "Padrão"
  theme until an admin deliberately turns this on.

  While disabled, the theme is hidden from the merchant's theme picker and any
  store that had it selected renders with "Padrão" instead (nothing is deleted —
  their theme choice and customization stay saved).

  ## New Tables
  - `platform_theme_settings`
    - `id` (int, primary key, always 1 – singleton row pattern)
    - `eletronicos_theme_enabled` (boolean, default false)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - SELECT for everyone (public storefronts need it to pick which theme to render)
  - INSERT/UPDATE only for admin users (role = 'admin' in public.users)
*/

CREATE TABLE IF NOT EXISTS platform_theme_settings (
  id integer PRIMARY KEY DEFAULT 1,
  eletronicos_theme_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_theme_settings_singleton CHECK (id = 1)
);

ALTER TABLE platform_theme_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform theme settings" ON platform_theme_settings;
CREATE POLICY "Anyone can read platform theme settings"
  ON platform_theme_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert platform theme settings" ON platform_theme_settings;
CREATE POLICY "Admins can insert platform theme settings"
  ON platform_theme_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update platform theme settings" ON platform_theme_settings;
CREATE POLICY "Admins can update platform theme settings"
  ON platform_theme_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

INSERT INTO platform_theme_settings (id, eletronicos_theme_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
