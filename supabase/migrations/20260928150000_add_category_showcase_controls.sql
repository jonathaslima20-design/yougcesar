/*
  # Category showcase controls (Eletrônicos theme)

  1. Changes to storefront_appearance
    - `category_showcase_enabled` (boolean, default true) — show/hide the whole
      "Navegue por Categorias" section.
    - `category_showcase_title` (text, nullable) — overrides the section heading;
      falls back to "Navegue por Categorias" in the UI when null.
    Both only read by the "eletronicos" theme's CategoryShowcase component.

  2. New table: storefront_category_images
    - One row per (user_id, category): a merchant-chosen image that overrides
      the auto-picked "first product in this category" image the section uses
      by default. Deleting the row (or never creating one) reverts to that
      automatic picture — no data loss, this table only ever adds an override.

  3. Security
    - RLS enabled: public SELECT (storefront needs to read it), owner-only
      INSERT/UPDATE/DELETE — same pattern as storefront_banners/benefits.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS category_showcase_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS category_showcase_title text DEFAULT NULL;

CREATE TABLE IF NOT EXISTS storefront_category_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  category text NOT NULL,
  image_url text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT storefront_category_images_user_category_key UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS storefront_category_images_user_id_idx ON storefront_category_images (user_id);

ALTER TABLE storefront_category_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view storefront category images"
  ON storefront_category_images
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert own category images"
  ON storefront_category_images
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category images"
  ON storefront_category_images
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own category images"
  ON storefront_category_images
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
