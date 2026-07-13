/*
  # Create system_storefront_appearance table

  1. New Tables
    - `system_storefront_appearance`
      - `id` (uuid, primary key) - single row identifier
      - All storefront appearance fields (colors, typography, effects, spacing, footer logo)
      - `updated_by` (uuid) - admin who last updated
      - `updated_at` (timestamptz) - last update timestamp
      - `created_at` (timestamptz) - creation timestamp

  2. Purpose
    - Stores the default system-wide appearance for all CorretorPages
    - Applied when a user has not created their own customization
    - Controlled exclusively by administrators

  3. Security
    - Enable RLS on table
    - Public SELECT for all users (storefront visitors need to read)
    - INSERT/UPDATE/DELETE restricted to authenticated users with admin role

  4. Seed Data
    - Inserts one default row with standard appearance values
*/

CREATE TABLE IF NOT EXISTS system_storefront_appearance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bg_color text NOT NULL DEFAULT '#ffffff',
  text_color text NOT NULL DEFAULT '#0a0a0a',
  heading_color text NOT NULL DEFAULT '#0a0a0a',
  button_bg_color text NOT NULL DEFAULT '#0f172a',
  button_text_color text NOT NULL DEFAULT '#f8fafc',
  accent_color text NOT NULL DEFAULT '#0f172a',
  card_bg_color text NOT NULL DEFAULT '#f8f9fa',
  card_border_color text NOT NULL DEFAULT '#e4e4e7',
  badge_bg_color text NOT NULL DEFAULT '#0f172a',
  badge_text_color text NOT NULL DEFAULT '#ffffff',
  icon_color text NOT NULL DEFAULT '#0a0a0a',
  muted_text_color text NOT NULL DEFAULT '#71717a',
  border_color text NOT NULL DEFAULT '#e4e4e7',
  cover_overlay_color text DEFAULT NULL,
  bg_gradient_enabled boolean NOT NULL DEFAULT false,
  bg_gradient_color_end text DEFAULT NULL,
  bg_gradient_direction text NOT NULL DEFAULT 'to bottom',
  font_family text NOT NULL DEFAULT 'Inter',
  heading_font_family text NOT NULL DEFAULT 'Inter Tight',
  font_size_base text NOT NULL DEFAULT 'md',
  card_border_radius text NOT NULL DEFAULT 'lg',
  card_shadow text NOT NULL DEFAULT 'sm',
  button_border_radius text NOT NULL DEFAULT 'md',
  image_border_radius text NOT NULL DEFAULT 'md',
  hover_effect text NOT NULL DEFAULT 'scale',
  cover_border_radius text NOT NULL DEFAULT 'none',
  section_spacing text NOT NULL DEFAULT 'normal',
  card_gap text NOT NULL DEFAULT 'normal',
  footer_logo_mode text NOT NULL DEFAULT 'default',
  footer_logo_format text NOT NULL DEFAULT 'rectangular',
  custom_logo_url text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_storefront_appearance ENABLE ROW LEVEL SECURITY;

-- Public read access (storefront visitors need to load the default theme)
CREATE POLICY "Anyone can read system appearance"
  ON system_storefront_appearance
  FOR SELECT
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert system appearance"
  ON system_storefront_appearance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update system appearance"
  ON system_storefront_appearance
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

-- Only admins can delete
CREATE POLICY "Admins can delete system appearance"
  ON system_storefront_appearance
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Seed initial default appearance row
INSERT INTO system_storefront_appearance (
  bg_color, text_color, heading_color, button_bg_color, button_text_color,
  accent_color, card_bg_color, card_border_color, badge_bg_color, badge_text_color,
  icon_color, muted_text_color, border_color, cover_overlay_color,
  bg_gradient_enabled, bg_gradient_color_end, bg_gradient_direction,
  font_family, heading_font_family, font_size_base,
  card_border_radius, card_shadow, button_border_radius, image_border_radius,
  hover_effect, cover_border_radius, section_spacing, card_gap,
  footer_logo_mode, footer_logo_format, custom_logo_url, is_active
) VALUES (
  '#ffffff', '#0a0a0a', '#0a0a0a', '#0f172a', '#f8fafc',
  '#0f172a', '#f8f9fa', '#e4e4e7', '#0f172a', '#ffffff',
  '#0a0a0a', '#71717a', '#e4e4e7', NULL,
  false, NULL, 'to bottom',
  'Inter', 'Inter Tight', 'md',
  'lg', 'sm', 'md', 'md',
  'scale', 'none', 'normal', 'normal',
  'default', 'rectangular', NULL, true
);