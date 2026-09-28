/*
  # Create storefront_benefits table

  1. New Tables
    - `storefront_benefits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `icon` (text) — key into the app's fixed icon registry (not a URL/upload)
      - `title` (text)
      - `subtitle` (text)
      - `sort_order` (int) — display order in the benefits bar
      - `is_active` (boolean) — inactive items are kept but hidden from the storefront
      - `created_at` / `updated_at`

  2. Security
    - Enable RLS on `storefront_benefits`
    - Public SELECT policy (needed for the storefront benefits bar)
    - Owner-only INSERT, UPDATE, DELETE policies

  3. Notes
    - Multiple rows per user_id, one per benefit item — same shape as `storefront_banners`.
    - Only used by the "eletronicos" storefront theme's BenefitsBar. A user with zero
      rows here has simply never opened "Personalizar Eletrônicos" yet: the storefront
      falls back to the same 5 default items it always showed (see DEFAULT_BENEFITS
      in src/lib/storefrontBenefitsDefaults.ts) until they customize and save.
*/

CREATE TABLE IF NOT EXISTS storefront_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  icon text NOT NULL DEFAULT 'credit-card',
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',

  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storefront_benefits_user_id_idx ON storefront_benefits (user_id, sort_order);

ALTER TABLE storefront_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view storefront benefits"
  ON storefront_benefits
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert own benefits"
  ON storefront_benefits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own benefits"
  ON storefront_benefits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own benefits"
  ON storefront_benefits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
