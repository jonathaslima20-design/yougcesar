/*
  # Create buyer_cart_items table (buyer's cart, persisted per account)

  1. New Tables
    - `buyer_cart_items`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers) - owning buyer
      - `product_id` (uuid, references products)
      - `variant_id` (text) - matches CartContext's generateVariantId(), i.e.
        `${productId}-${color}-${size}-${flavor}-${weightVariantId}`. This is
        the natural key for "this exact line item" so quantity updates upsert
        instead of creating duplicate rows.
      - snapshot columns (title, price, discounted_price, featured_image_url,
        short_description, is_starting_price, notes, selected color/size/
        flavor, available color/size/flavor lists, tiered pricing fields,
        weight-variant fields) - mirror the CartItem shape 1:1 so the client
        can round-trip without re-fetching products just to render the cart.
      - `quantity` (integer)
      - `created_at`, `updated_at` (timestamptz)
      - Unique on (customer_id, variant_id)

  2. Security
    - Enable RLS
    - Buyers can select/insert/update/delete only their own cart rows
      (auth.uid() = customer_id) — mirrors buyer_favorites, plus UPDATE
      since quantities change constantly (favorites never needed that).
*/

CREATE TABLE IF NOT EXISTS buyer_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  title text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  discounted_price numeric,
  quantity integer NOT NULL DEFAULT 1,
  featured_image_url text,
  short_description text,
  is_starting_price boolean,
  notes text,
  selected_color text,
  selected_size text,
  selected_flavor text,
  available_colors text[],
  available_sizes text[],
  available_flavors text[],
  has_tiered_pricing boolean,
  applied_tier_price numeric,
  selected_variant_id text,
  selected_variant_label text,
  variant_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_cart_items_unique UNIQUE (customer_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_cart_items_customer_id ON buyer_cart_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_cart_items_product_id ON buyer_cart_items(product_id);

ALTER TABLE buyer_cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view own cart items" ON buyer_cart_items;
CREATE POLICY "Buyers can view own cart items"
  ON buyer_cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can insert own cart items" ON buyer_cart_items;
CREATE POLICY "Buyers can insert own cart items"
  ON buyer_cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can update own cart items" ON buyer_cart_items;
CREATE POLICY "Buyers can update own cart items"
  ON buyer_cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can delete own cart items" ON buyer_cart_items;
CREATE POLICY "Buyers can delete own cart items"
  ON buyer_cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);
