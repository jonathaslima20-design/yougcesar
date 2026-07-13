/*
  # Add payment method and delivery fee columns to orders

  1. Modified Tables
    - `orders`
      - `payment_method` (text, nullable) - The payment method chosen by the customer (e.g., PIX, Credit Card)
      - `payment_method_discount` (numeric, default 0) - Discount amount applied for the chosen payment method
      - `delivery_fee` (numeric, default 0) - Delivery fee charged for the order
      - `delivery_option` (text, nullable) - The delivery option chosen by the customer (e.g., Store Pickup, Downtown)

  2. Important Notes
    - All new columns are nullable or have safe defaults to avoid breaking existing orders
    - No RLS changes needed as the existing orders RLS policies cover these new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method_discount'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method_discount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_fee'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_fee numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivery_option'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivery_option text;
  END IF;
END $$;
