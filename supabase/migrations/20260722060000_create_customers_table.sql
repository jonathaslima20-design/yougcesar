/*
  # Create customers table (buyer accounts, separate from merchant users)

  1. New Tables
    - `customers`
      - `id` (uuid, primary key, references auth.users) - same auth identity used
        by merchants, but this is a completely separate application profile
      - `email` (text)
      - `full_name` (text)
      - `whatsapp` (text, nullable)
      - `country_code` (text, default '55')
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Customers can view/update/insert only their own row (auth.uid() = id)
    - No public/anon SELECT policy: merchants already see customer_name/
      customer_whatsapp frozen on the order itself, they never need to read
      this table directly

  3. Notes
    - This is a single, platform-wide buyer identity (not scoped per merchant/store)
    - A person can have both a `users` row (merchant) and a `customers` row
      (buyer) under the same auth.users id with no conflict
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  whatsapp text,
  country_code text NOT NULL DEFAULT '55',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own profile" ON customers;
CREATE POLICY "Customers can view own profile"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Customers can update own profile" ON customers;
CREATE POLICY "Customers can update own profile"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Customers can insert own profile" ON customers;
CREATE POLICY "Customers can insert own profile"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON customers;
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();
