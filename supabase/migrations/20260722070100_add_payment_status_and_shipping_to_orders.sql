/*
  # Add payment_status and shipping address columns to orders

  1. Modified Tables
    - `orders`
      - `payment_status` (text, default 'not_applicable') - separate from the
        existing fulfillment `status`. A WhatsApp order stays 'not_applicable'
        forever; an ecommerce order tracks pending/approved/rejected/refunded/
        cancelled independently of fulfillment progress.
      - `shipping_street`, `shipping_number`, `shipping_complement`,
        `shipping_neighborhood`, `shipping_city`, `shipping_state`,
        `shipping_zip_code` (all nullable text) - only populated by the new
        ecommerce checkout path.

  2. Notes
    - All new columns are nullable or have safe defaults; zero impact on
      existing WhatsApp orders.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text NOT NULL DEFAULT 'not_applicable';
  END IF;
END $$;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS valid_payment_status;
ALTER TABLE orders ADD CONSTRAINT valid_payment_status
  CHECK (payment_status IN ('not_applicable','pending','approved','rejected','refunded','cancelled'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_street'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_street text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_complement'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_complement text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_neighborhood'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_neighborhood text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_city'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_state'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_zip_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_zip_code text;
  END IF;
END $$;
