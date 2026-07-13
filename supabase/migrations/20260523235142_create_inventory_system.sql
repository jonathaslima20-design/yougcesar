/*
  # Create Optional Inventory System

  1. Modified Tables
    - `products`
      - `track_inventory` (boolean, default false) - Whether this product has inventory tracking enabled
      - `stock_quantity` (integer, nullable, default NULL) - Current stock quantity; NULL means untracked
      - `low_stock_threshold` (integer, default 5) - Threshold for low stock notifications
    - `orders`
      - `inventory_deducted` (boolean, default false) - Whether stock was deducted for this order

  2. Indexes
    - Partial index on products(user_id, stock_quantity) WHERE track_inventory = true
      for efficient low-stock/out-of-stock queries

  3. Security
    - No RLS changes needed; existing product and order policies apply

  4. Important Notes
    - No existing columns are modified
    - The product `status` field (disponivel/vendido/reservado) remains independent
    - inventory_deducted on orders tracks whether stock was reduced, enabling restoration on cancel
*/

-- Add inventory columns to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'track_inventory'
  ) THEN
    ALTER TABLE products ADD COLUMN track_inventory boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'stock_quantity'
  ) THEN
    ALTER TABLE products ADD COLUMN stock_quantity integer DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'low_stock_threshold'
  ) THEN
    ALTER TABLE products ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 5;
  END IF;
END $$;

-- Add inventory_deducted column to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'inventory_deducted'
  ) THEN
    ALTER TABLE orders ADD COLUMN inventory_deducted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create partial index for efficient inventory queries
CREATE INDEX IF NOT EXISTS idx_products_inventory_tracking
  ON products (user_id, stock_quantity)
  WHERE track_inventory = true;
