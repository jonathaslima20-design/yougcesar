/*
  # Create product_weight_variants table

  1. New Tables
    - `product_weight_variants`
      - `id` (uuid, primary key)
      - `product_id` (uuid, FK to products, cascade delete)
      - `label` (text, e.g. "1kg", "500g")
      - `unit_value` (numeric, e.g. 1, 0.5)
      - `unit_type` (text, e.g. 'kg', 'g', 'ml', 'l', 'un')
      - `price` (numeric)
      - `discounted_price` (numeric, nullable)
      - `display_order` (int)
      - `created_at`, `updated_at`
    - Unique constraint: (product_id, label)
    - Index on (product_id, display_order)

  2. Table Alterations
    - Add `has_weight_variants` boolean to `products`
    - Add `min_variant_price` numeric to `products`
    - Add `max_variant_price` numeric to `products`

  3. Triggers
    - Recalculate products.min_variant_price/max_variant_price on variant changes

  4. Security
    - Enable RLS on product_weight_variants
    - Owner can select/insert/update/delete own variants
    - Public (anon + authenticated) can read variants of visible products
*/

CREATE TABLE IF NOT EXISTS product_weight_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label text NOT NULL,
  unit_value numeric NOT NULL DEFAULT 0,
  unit_type text NOT NULL DEFAULT 'un',
  price numeric NOT NULL DEFAULT 0,
  discounted_price numeric,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT product_weight_variants_unique_label UNIQUE (product_id, label)
);

CREATE INDEX IF NOT EXISTS idx_pwv_product_order
  ON product_weight_variants (product_id, display_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'has_weight_variants'
  ) THEN
    ALTER TABLE products ADD COLUMN has_weight_variants boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'min_variant_price'
  ) THEN
    ALTER TABLE products ADD COLUMN min_variant_price numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'max_variant_price'
  ) THEN
    ALTER TABLE products ADD COLUMN max_variant_price numeric;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION recalc_product_variant_prices(p_product_id uuid)
RETURNS void AS $$
DECLARE
  v_min numeric;
  v_max numeric;
BEGIN
  SELECT
    MIN(COALESCE(discounted_price, price)),
    MAX(COALESCE(discounted_price, price))
  INTO v_min, v_max
  FROM product_weight_variants
  WHERE product_id = p_product_id;

  UPDATE products
  SET min_variant_price = v_min,
      max_variant_price = v_max,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_pwv_recalc()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalc_product_variant_prices(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM recalc_product_variant_prices(NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pwv_recalc_prices_trigger ON product_weight_variants;
CREATE TRIGGER pwv_recalc_prices_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_weight_variants
  FOR EACH ROW EXECUTE FUNCTION trg_pwv_recalc();

ALTER TABLE product_weight_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own weight variants" ON product_weight_variants;
CREATE POLICY "Owners can view own weight variants"
  ON product_weight_variants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_weight_variants.product_id
        AND products.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can view variants of visible products" ON product_weight_variants;
CREATE POLICY "Public can view variants of visible products"
  ON product_weight_variants FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_weight_variants.product_id
        AND products.is_visible_on_storefront = true
    )
  );

DROP POLICY IF EXISTS "Owners can insert weight variants" ON product_weight_variants;
CREATE POLICY "Owners can insert weight variants"
  ON product_weight_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_weight_variants.product_id
        AND products.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update weight variants" ON product_weight_variants;
CREATE POLICY "Owners can update weight variants"
  ON product_weight_variants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_weight_variants.product_id
        AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_weight_variants.product_id
        AND products.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can delete weight variants" ON product_weight_variants;
CREATE POLICY "Owners can delete weight variants"
  ON product_weight_variants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_weight_variants.product_id
        AND products.user_id = auth.uid()
    )
  );
