/*
  # Create storefront_mini_banners table

  1. New Tables
    - `storefront_mini_banners`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `image_url` (text) — a single image per card (text/CTA baked into the image,
        same convention as `storefront_banners`), roughly portrait (416x480 reference)
      - `link_url` (text, nullable)
      - `sort_order` (int)
      - `is_active` (boolean)
      - `created_at` / `updated_at`

  2. Security
    - Enable RLS, public SELECT, owner-only INSERT/UPDATE/DELETE — same pattern as
      storefront_banners / storefront_benefits.

  3. Notes
    - A second, independent banner section for the "eletronicos" theme: a 3-column
      grid of smaller promo cards, placed after "Navegue por Categorias" and before
      the product grid. Unrelated to `storefront_banners` (the big top carousel).
*/

CREATE TABLE IF NOT EXISTS storefront_mini_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  image_url text NOT NULL,
  link_url text DEFAULT NULL,

  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storefront_mini_banners_user_id_idx ON storefront_mini_banners (user_id, sort_order);

ALTER TABLE storefront_mini_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view storefront mini banners"
  ON storefront_mini_banners
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert own mini banners"
  ON storefront_mini_banners
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mini banners"
  ON storefront_mini_banners
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mini banners"
  ON storefront_mini_banners
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
