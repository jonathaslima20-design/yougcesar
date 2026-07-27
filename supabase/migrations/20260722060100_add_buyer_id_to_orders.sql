/*
  # Add buyer_id to orders (links an ecommerce order to a logged-in customer account)

  1. Modified Tables
    - `orders`
      - `buyer_id` (uuid, nullable, FK to customers) - the logged-in customer who
        placed the order. Null for WhatsApp orders (still fully guest/anonymous).
        Required (via CHECK constraint) for order_type = 'ecommerce' orders,
        since online payment now requires an account.

  2. Security
    - New SELECT policy: a logged-in customer can view their own orders
      (auth.uid() = buyer_id), across any store - this is what powers the
      customer's own order history page and payment status polling.

  3. Notes
    - No backfill needed: all existing orders are order_type = 'whatsapp',
      which the CHECK constraint does not require buyer_id for.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'buyer_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN buyer_id uuid REFERENCES customers(id);
  END IF;
END $$;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS ecommerce_requires_buyer;
ALTER TABLE orders ADD CONSTRAINT ecommerce_requires_buyer
  CHECK (order_type <> 'ecommerce' OR buyer_id IS NOT NULL);

DROP POLICY IF EXISTS "Buyers can view own orders" ON orders;
CREATE POLICY "Buyers can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders (buyer_id) WHERE buyer_id IS NOT NULL;
