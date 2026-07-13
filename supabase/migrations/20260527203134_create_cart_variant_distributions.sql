/*
  # Create cart variant distributions tables

  1. New Tables
    - `cart_variant_distributions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `product_id` (uuid, references products)
      - `total_quantity` (integer, total units in distribution)
      - `applied_tier_price` (numeric, price per unit based on tier)
      - `metadata` (jsonb, stores tier info like tier_id, min/max quantity, original price)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `cart_distribution_items`
      - `id` (uuid, primary key)
      - `distribution_id` (uuid, references cart_variant_distributions with CASCADE delete)
      - `color` (text, nullable, variant color)
      - `size` (text, nullable, variant size)
      - `quantity` (integer, quantity for this variant)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only manage their own distributions
    - Distribution items are accessible if the user owns the parent distribution
*/

-- Cart variant distributions (main distribution records)
CREATE TABLE IF NOT EXISTS cart_variant_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  total_quantity integer NOT NULL DEFAULT 0,
  applied_tier_price numeric NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Cart distribution items (individual variant line items)
CREATE TABLE IF NOT EXISTS cart_distribution_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES cart_variant_distributions(id) ON DELETE CASCADE,
  color text,
  size text,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cart_variant_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_distribution_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for cart_variant_distributions
CREATE POLICY "Users can view own distributions"
  ON cart_variant_distributions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own distributions"
  ON cart_variant_distributions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own distributions"
  ON cart_variant_distributions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own distributions"
  ON cart_variant_distributions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS policies for cart_distribution_items (access through parent distribution ownership)
CREATE POLICY "Users can view own distribution items"
  ON cart_distribution_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cart_variant_distributions
      WHERE cart_variant_distributions.id = cart_distribution_items.distribution_id
      AND cart_variant_distributions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own distribution items"
  ON cart_distribution_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cart_variant_distributions
      WHERE cart_variant_distributions.id = cart_distribution_items.distribution_id
      AND cart_variant_distributions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own distribution items"
  ON cart_distribution_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cart_variant_distributions
      WHERE cart_variant_distributions.id = cart_distribution_items.distribution_id
      AND cart_variant_distributions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cart_variant_distributions
      WHERE cart_variant_distributions.id = cart_distribution_items.distribution_id
      AND cart_variant_distributions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own distribution items"
  ON cart_distribution_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cart_variant_distributions
      WHERE cart_variant_distributions.id = cart_distribution_items.distribution_id
      AND cart_variant_distributions.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_variant_distributions_user_id ON cart_variant_distributions(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_variant_distributions_product_id ON cart_variant_distributions(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_distribution_items_distribution_id ON cart_distribution_items(distribution_id);