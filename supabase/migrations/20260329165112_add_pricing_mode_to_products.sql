/*
  # Add Pricing Mode to Products

  1. Changes
    - Add `pricing_mode` column to products table
      - Type: text with check constraint ('range' or 'exact')
      - Default: 'range' (for backward compatibility)
    - This allows products to use either:
      - 'range': Traditional tiered pricing with min/max quantities (e.g., 1-4, 5-9, 10+)
      - 'exact': Exact quantity pricing (e.g., 1 unit, 2 units, 3 units)

  2. Notes
    - Existing products will default to 'range' mode
    - New products can choose between 'range' or 'exact' mode
    - In 'exact' mode, each tier represents a specific quantity, not a range
*/

-- Add pricing_mode column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'pricing_mode'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN pricing_mode text DEFAULT 'range' CHECK (pricing_mode IN ('range', 'exact'));
  END IF;
END $$;
