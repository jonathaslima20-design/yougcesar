/*
  # Create customer_addresses table (buyer's saved shipping addresses)

  1. New Tables
    - `customer_addresses`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers) - owning buyer
      - `label` (text) - e.g. "Casa", "Trabalho"
      - `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `zip_code` (text)
      - `is_default` (boolean, default false)
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Buyers can select/insert/update/delete only their own addresses (auth.uid() = customer_id)

  3. Notes
    - Mirrors the flat shipping_* columns already frozen onto `orders`
      (see 20260722070100_add_payment_status_and_shipping_to_orders.sql);
      addresses saved here are just a reusable source to prefill those
      columns at checkout, not a foreign key from orders.
*/

CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Casa',
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  neighborhood text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view own addresses" ON customer_addresses;
CREATE POLICY "Buyers can view own addresses"
  ON customer_addresses FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can insert own addresses" ON customer_addresses;
CREATE POLICY "Buyers can insert own addresses"
  ON customer_addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can update own addresses" ON customer_addresses;
CREATE POLICY "Buyers can update own addresses"
  ON customer_addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Buyers can delete own addresses" ON customer_addresses;
CREATE POLICY "Buyers can delete own addresses"
  ON customer_addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE OR REPLACE FUNCTION update_customer_addresses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER trigger_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_addresses_updated_at();
