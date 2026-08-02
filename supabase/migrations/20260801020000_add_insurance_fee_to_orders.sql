/*
  # Add insurance_fee column to orders

  1. Modified Tables
    - `orders`
      - `insurance_fee` (numeric, default 0) - Shipping insurance fee charged
        for the order when the buyer opted in at checkout. Calculated as the
        merchant's configured percentage rate applied to the subtotal after
        coupon discount (same base used for the delivery "free above X"
        threshold).

  2. Important Notes
    - Nullable-safe default of 0 so existing orders and the WhatsApp order
      flow (which never sends this) are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'insurance_fee'
  ) THEN
    ALTER TABLE orders ADD COLUMN insurance_fee numeric DEFAULT 0;
  END IF;
END $$;
