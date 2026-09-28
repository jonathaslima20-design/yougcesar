/*
  # Create storefront_banners table

  1. New Tables
    - `storefront_banners`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `image_url_desktop` (text)
      - `image_url_mobile` (text)
      - `link_url` (text, nullable) — optional click-through destination
      - `sort_order` (int) — display order in the carousel
      - `is_active` (boolean) — inactive banners are kept but hidden from the storefront
      - `created_at` / `updated_at`

  2. Security
    - Enable RLS on `storefront_banners`
    - Public SELECT policy (needed for the storefront carousel)
    - Owner-only INSERT, UPDATE, DELETE policies

  3. Notes
    - Multiple rows per user_id (unlike `storefront_appearance`), one per banner.
    - Only used by the "eletronicos" storefront theme; the "padrao" theme keeps using the
      single banner fields on `users` (`promotional_banner_url_desktop/mobile`) untouched.
*/

CREATE TABLE IF NOT EXISTS storefront_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  image_url_desktop text NOT NULL,
  image_url_mobile text NOT NULL,
  link_url text DEFAULT NULL,

  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storefront_banners_user_id_idx ON storefront_banners (user_id, sort_order);

ALTER TABLE storefront_banners ENABLE ROW LEVEL SECURITY;

-- Public can read any active/inactive banner row (storefront filters by is_active itself)
CREATE POLICY "Anyone can view storefront banners"
  ON storefront_banners
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only the owner can insert their own banners
CREATE POLICY "Users can insert own banners"
  ON storefront_banners
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can update their own banners
CREATE POLICY "Users can update own banners"
  ON storefront_banners
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can delete their own banners
CREATE POLICY "Users can delete own banners"
  ON storefront_banners
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
