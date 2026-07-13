/*
  # Create storefront_appearance table

  1. New Tables
    - `storefront_appearance`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - Color fields: bg_color, text_color, heading_color, button_bg_color, button_text_color, accent_color, card_bg_color, card_border_color, badge_bg_color, badge_text_color, icon_color, muted_text_color, border_color, cover_overlay_color
      - Typography fields: font_family, heading_font_family, font_size_base
      - Effects fields: card_border_radius, card_shadow, button_border_radius, image_border_radius, hover_effect, cover_border_radius
      - Spacing fields: section_spacing, card_gap
      - Control fields: is_active, created_at, updated_at

  2. Security
    - Enable RLS on `storefront_appearance` table
    - Public SELECT policy (needed for CorretorPage visitors)
    - Owner-only INSERT, UPDATE, DELETE policies

  3. Notes
    - Default color values match the current light theme (slate dark primary, white background)
    - One row per user (unique constraint on user_id)
*/

CREATE TABLE IF NOT EXISTS storefront_appearance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Colors
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
  
  -- Typography
  font_family text NOT NULL DEFAULT 'Inter',
  heading_font_family text NOT NULL DEFAULT 'Inter Tight',
  font_size_base text NOT NULL DEFAULT 'md',
  
  -- Effects / Borders
  card_border_radius text NOT NULL DEFAULT 'lg',
  card_shadow text NOT NULL DEFAULT 'sm',
  button_border_radius text NOT NULL DEFAULT 'md',
  image_border_radius text NOT NULL DEFAULT 'md',
  hover_effect text NOT NULL DEFAULT 'scale',
  cover_border_radius text NOT NULL DEFAULT 'none',
  
  -- Spacing
  section_spacing text NOT NULL DEFAULT 'normal',
  card_gap text NOT NULL DEFAULT 'normal',
  
  -- Control
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT storefront_appearance_user_id_key UNIQUE (user_id),
  CONSTRAINT storefront_appearance_font_size_base_check CHECK (font_size_base IN ('sm', 'md', 'lg')),
  CONSTRAINT storefront_appearance_card_border_radius_check CHECK (card_border_radius IN ('none', 'sm', 'md', 'lg', 'full')),
  CONSTRAINT storefront_appearance_card_shadow_check CHECK (card_shadow IN ('none', 'sm', 'md', 'lg')),
  CONSTRAINT storefront_appearance_button_border_radius_check CHECK (button_border_radius IN ('none', 'sm', 'md', 'lg', 'full')),
  CONSTRAINT storefront_appearance_image_border_radius_check CHECK (image_border_radius IN ('none', 'sm', 'md', 'lg', 'full')),
  CONSTRAINT storefront_appearance_hover_effect_check CHECK (hover_effect IN ('none', 'scale', 'lift', 'glow')),
  CONSTRAINT storefront_appearance_cover_border_radius_check CHECK (cover_border_radius IN ('none', 'sm', 'md', 'lg', 'xl')),
  CONSTRAINT storefront_appearance_section_spacing_check CHECK (section_spacing IN ('compact', 'normal', 'relaxed')),
  CONSTRAINT storefront_appearance_card_gap_check CHECK (card_gap IN ('compact', 'normal', 'relaxed'))
);

ALTER TABLE storefront_appearance ENABLE ROW LEVEL SECURITY;

-- Public can read any storefront appearance (needed for CorretorPage visitors)
CREATE POLICY "Anyone can view storefront appearance"
  ON storefront_appearance
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only the owner can insert their own appearance settings
CREATE POLICY "Users can insert own appearance"
  ON storefront_appearance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can update their own appearance settings
CREATE POLICY "Users can update own appearance"
  ON storefront_appearance
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can delete their own appearance settings
CREATE POLICY "Users can delete own appearance"
  ON storefront_appearance
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
