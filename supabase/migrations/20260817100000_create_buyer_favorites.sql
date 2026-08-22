/*
  # Create buyer_favorites table (buyer's saved/favorited products)

  1. New Tables
    - `buyer_favorites`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers) - owning buyer
      - `product_id` (uuid, references products) - favorited product
      - `store_owner_id` (uuid, references users) - denormalized store owner,
        avoids a join through products just to filter/group by store on the
        buyer's favorites page
      - `created_at` (timestamptz)
      - Unique on (customer_id, product_id) — favoriting twice is a no-op,
        not a duplicate row

  2. Security
    - Enable RLS
    - Buyers can select/insert/delete only their own favorites
      (auth.uid() = customer_id) — mirrors customer_addresses exactly.
      No UPDATE policy: a favorite is either present or absent, never edited.
*/

CREATE TABLE IF NOT EXISTS buyer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_favorites_unique UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_favorites_customer_id ON buyer_favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_favorites_product_id ON buyer_favorites(product_id);

ALTER TABLE buyer_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view own favorites" ON buyer_favorites;
CREATE POLICY "Buyers can view own favorites"
  ON buyer_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can insert own favorites" ON buyer_favorites;
CREATE POLICY "Buyers can insert own favorites"
  ON buyer_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can delete own favorites" ON buyer_favorites;
CREATE POLICY "Buyers can delete own favorites"
  ON buyer_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);
