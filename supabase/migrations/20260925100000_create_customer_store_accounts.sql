/*
  # Per-store buyer accounts (customer_store_accounts)

  1. Problem
     - `customers` is a single platform-wide buyer identity, and the /conta
       area aggregated data across every store the buyer touched. A merchant
       who sees that their customer's login is shared with other stores may
       feel it as competition, so the buyer experience must look like an
       account that belongs to ONE store.

  2. Approach
     - The login identity (auth.users / customers) stays single — Supabase
       Auth requires unique e-mails and Google sign-in maps to one user per
       e-mail, so truly separate identities are not viable.
     - This table records which stores a buyer has an account in. The buyer
       area is now always opened in the context of one store (/:slug/conta)
       and only ever shows that store's data. Nothing in the UI or in any
       merchant-facing read reveals other stores.

  3. New Table
     - `customer_store_accounts(customer_id, store_owner_id, created_at)`,
       primary key (customer_id, store_owner_id).

  4. Security
     - RLS enabled. Buyers can SELECT only their own rows. No INSERT/UPDATE/
       DELETE policies: rows are created by `join_store` (called at
       signup/login through a store, and when opening /:slug/conta) or by the
       orders trigger, both SECURITY DEFINER.

  5. Backfill
     - Existing buyers get an account in every store where they already have
       an order or a cashback balance.
*/

CREATE TABLE IF NOT EXISTS customer_store_accounts (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, store_owner_id)
);

CREATE INDEX IF NOT EXISTS customer_store_accounts_store_idx
  ON customer_store_accounts (store_owner_id);

ALTER TABLE customer_store_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own store accounts" ON customer_store_accounts;
CREATE POLICY "Customers can view own store accounts"
  ON customer_store_accounts FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Idempotent: creates the (buyer, store) account for the calling buyer.
-- Returns the store's id, or NULL when the slug is not a storefront or the
-- caller has no buyer profile yet.
CREATE OR REPLACE FUNCTION join_store(p_store_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_store_id
  FROM users
  WHERE slug = p_store_slug AND role = 'corretor'
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = auth.uid()) THEN
    RETURN NULL;
  END IF;

  INSERT INTO customer_store_accounts (customer_id, store_owner_id)
  VALUES (auth.uid(), v_store_id)
  ON CONFLICT DO NOTHING;

  RETURN v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION join_store(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION join_store(text) FROM anon;
GRANT EXECUTE ON FUNCTION join_store(text) TO authenticated;

-- Placing an order in a store always implies having an account there. Never
-- allowed to fail the order itself.
CREATE OR REPLACE FUNCTION ensure_store_account_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.buyer_id IS NOT NULL AND NEW.store_owner_id IS NOT NULL THEN
    BEGIN
      INSERT INTO customer_store_accounts (customer_id, store_owner_id)
      VALUES (NEW.buyer_id, NEW.store_owner_id)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_store_account_for_order ON orders;
CREATE TRIGGER trigger_ensure_store_account_for_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION ensure_store_account_for_order();

-- Backfill from existing activity.
INSERT INTO customer_store_accounts (customer_id, store_owner_id)
SELECT DISTINCT o.buyer_id, o.store_owner_id
FROM orders o
WHERE o.buyer_id IS NOT NULL AND o.store_owner_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM customers c WHERE c.id = o.buyer_id)
ON CONFLICT DO NOTHING;

INSERT INTO customer_store_accounts (customer_id, store_owner_id)
SELECT DISTINCT b.customer_id, b.store_owner_id
FROM cashback_balances b
ON CONFLICT DO NOTHING;
