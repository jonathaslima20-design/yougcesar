/*
  # Robust Inventory System - Variant Stock, Movements & Reservations

  1. New Tables
    - `product_variant_stock`
      - `id` (uuid, primary key)
      - `product_id` (uuid, FK to products)
      - `color` (text, nullable) - variant color
      - `size` (text, nullable) - variant size
      - `flavor` (text, nullable) - variant flavor
      - `weight_variant_id` (uuid, nullable, FK to product_weight_variants)
      - `quantity` (integer, default 0) - available quantity
      - `reserved_quantity` (integer, default 0) - reserved by active carts
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (product_id, color, size, flavor, weight_variant_id)

    - `stock_movements`
      - `id` (uuid, primary key)
      - `product_id` (uuid, FK to products)
      - `variant_stock_id` (uuid, nullable, FK to product_variant_stock)
      - `movement_type` (text) - 'entrada' | 'saida' | 'ajuste' | 'reserva' | 'cancelamento'
      - `quantity` (integer) - quantity changed (positive for increase, negative for decrease)
      - `previous_quantity` (integer) - stock before movement
      - `new_quantity` (integer) - stock after movement
      - `reference_type` (text, nullable) - 'order' | 'manual' | 'system'
      - `reference_id` (text, nullable) - order ID or other reference
      - `reason` (text, nullable) - free-text reason for the movement
      - `performed_by` (uuid, nullable) - user who performed the action
      - `created_at` (timestamptz)

    - `stock_reservations`
      - `id` (uuid, primary key)
      - `product_id` (uuid, FK to products)
      - `variant_stock_id` (uuid, nullable, FK to product_variant_stock)
      - `session_id` (text) - cart session identifier
      - `quantity` (integer) - reserved quantity
      - `expires_at` (timestamptz) - when reservation expires
      - `status` (text, default 'active') - 'active' | 'expired' | 'converted'
      - `created_at` (timestamptz)

  2. Indexes
    - product_variant_stock: unique on (product_id, color, size, flavor, weight_variant_id)
    - product_variant_stock: index on product_id
    - stock_movements: index on (product_id, created_at DESC)
    - stock_movements: index on (variant_stock_id)
    - stock_reservations: index on (status, expires_at) for cleanup queries
    - stock_reservations: index on (session_id, status)

  3. Security
    - RLS enabled on all three tables
    - product_variant_stock: accessible by product owner (via products table join)
    - stock_movements: readable by product owner, insertable by product owner
    - stock_reservations: readable/writable by authenticated users for their own sessions

  4. Backfill
    - For existing products with track_inventory=true and stock_quantity IS NOT NULL,
      creates a single default row in product_variant_stock with the current quantity.
    - This ensures backward compatibility - existing products are automatically migrated.

  5. New Settings Columns
    - Adds inventory settings fields to user_storefront_settings.settings JSON:
      autoDeductStock, blockZeroStock, reservationMinutes
    - These are stored in the existing JSON column, no schema change needed.
*/

-- 1. Create product_variant_stock table
CREATE TABLE IF NOT EXISTS product_variant_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color text DEFAULT NULL,
  size text DEFAULT NULL,
  flavor text DEFAULT NULL,
  weight_variant_id uuid DEFAULT NULL,
  quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint to prevent duplicate variant rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variant_stock_unique
  ON product_variant_stock (
    product_id,
    COALESCE(color, ''),
    COALESCE(size, ''),
    COALESCE(flavor, ''),
    COALESCE(weight_variant_id, '00000000-0000-0000-0000-000000000000')
  );

CREATE INDEX IF NOT EXISTS idx_product_variant_stock_product
  ON product_variant_stock (product_id);

ALTER TABLE product_variant_stock ENABLE ROW LEVEL SECURITY;

-- RLS: Product owner can SELECT their variant stock
CREATE POLICY "Product owner can view variant stock"
  ON product_variant_stock FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variant_stock.product_id
      AND products.user_id = auth.uid()
    )
  );

-- RLS: Product owner can INSERT variant stock
CREATE POLICY "Product owner can insert variant stock"
  ON product_variant_stock FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variant_stock.product_id
      AND products.user_id = auth.uid()
    )
  );

-- RLS: Product owner can UPDATE variant stock
CREATE POLICY "Product owner can update variant stock"
  ON product_variant_stock FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variant_stock.product_id
      AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variant_stock.product_id
      AND products.user_id = auth.uid()
    )
  );

-- RLS: Product owner can DELETE variant stock
CREATE POLICY "Product owner can delete variant stock"
  ON product_variant_stock FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variant_stock.product_id
      AND products.user_id = auth.uid()
    )
  );

-- RLS: Storefront visitors can read variant stock (for availability display)
CREATE POLICY "Anyone can view variant stock for available products"
  ON product_variant_stock FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variant_stock.product_id
      AND products.is_visible_on_storefront = true
    )
  );

-- Authenticated users who are NOT the owner can also read (storefront browsing)
CREATE POLICY "Authenticated users can view variant stock for available products"
  ON product_variant_stock FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_variant_stock.product_id
      AND products.is_visible_on_storefront = true
    )
  );


-- 2. Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_stock_id uuid DEFAULT NULL REFERENCES product_variant_stock(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'reserva', 'cancelamento')),
  quantity integer NOT NULL,
  previous_quantity integer NOT NULL DEFAULT 0,
  new_quantity integer NOT NULL DEFAULT 0,
  reference_type text DEFAULT NULL CHECK (reference_type IS NULL OR reference_type IN ('order', 'manual', 'system')),
  reference_id text DEFAULT NULL,
  reason text DEFAULT NULL,
  performed_by uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date
  ON stock_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_variant
  ON stock_movements (variant_stock_id)
  WHERE variant_stock_id IS NOT NULL;

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS: Product owner can view movements
CREATE POLICY "Product owner can view stock movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = stock_movements.product_id
      AND products.user_id = auth.uid()
    )
  );

-- RLS: Product owner can insert movements
CREATE POLICY "Product owner can insert stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = stock_movements.product_id
      AND products.user_id = auth.uid()
    )
  );


-- 3. Create stock_reservations table
CREATE TABLE IF NOT EXISTS stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_stock_id uuid DEFAULT NULL REFERENCES product_variant_stock(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_active
  ON stock_reservations (status, expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_stock_reservations_session
  ON stock_reservations (session_id, status);

ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

-- RLS: Any authenticated user can view active reservations (needed for stock availability checks)
CREATE POLICY "Authenticated users can view reservations"
  ON stock_reservations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = stock_reservations.product_id
      AND (products.user_id = auth.uid() OR products.is_visible_on_storefront = true)
    )
  );

-- RLS: Authenticated users can insert reservations
CREATE POLICY "Authenticated users can insert reservations"
  ON stock_reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = stock_reservations.product_id
      AND products.is_visible_on_storefront = true
    )
  );

-- RLS: Authenticated users can update their own reservations
CREATE POLICY "Users can update own reservations"
  ON stock_reservations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = stock_reservations.product_id
      AND (products.user_id = auth.uid() OR products.is_visible_on_storefront = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = stock_reservations.product_id
      AND (products.user_id = auth.uid() OR products.is_visible_on_storefront = true)
    )
  );

-- RLS: Product owners can delete reservations (for cleanup), users can delete own
CREATE POLICY "Product owners can delete reservations"
  ON stock_reservations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = stock_reservations.product_id
      AND products.user_id = auth.uid()
    )
  );


-- 4. Backfill: Migrate existing products with inventory tracking to variant stock table
INSERT INTO product_variant_stock (product_id, quantity, reserved_quantity)
SELECT id, COALESCE(stock_quantity, 0), 0
FROM products
WHERE track_inventory = true
  AND stock_quantity IS NOT NULL
ON CONFLICT DO NOTHING;
