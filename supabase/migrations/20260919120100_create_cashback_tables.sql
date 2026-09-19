/*
  # Create cashback balances/transactions and add orders.cashback_used

  1. Problem
     - New cashback feature: buyers earn a merchant-configurable % of what
       they actually paid online back as store credit, redeemable as a
       discount on a future order at the SAME store. No existing table
       models a buyer<->store balance — `customers` is a single
       platform-wide profile, not scoped per store.

  2. New Tables
     - `cashback_balances(customer_id, store_owner_id, balance, updated_at)`
       — current spendable balance per (buyer, store) pair.
     - `cashback_transactions(id, customer_id, store_owner_id, order_id,
       type, amount, created_at)` — audit trail. `type` is 'earned' (credited
       when the paying order's payment is approved) or 'redeemed' (debited
       when used as a discount on a later order). Two partial unique
       indexes on `order_id` (one per type) let a single order appear once
       as a redemption (at creation) and — a different order, later — once
       as an earning event (at payment approval), while still blocking any
       double-credit from a duplicate webhook delivery or double-redeem
       from a retried checkout submit.

  3. Modified Tables
     - `orders.cashback_used` — mirrors `discount_amount`/`insurance_fee`:
       the amount of the buyer's cashback balance applied to this order.

  4. Security
     - RLS enabled on both new tables. Buyers can only SELECT their own
       rows (`customer_id = auth.uid()`). No INSERT/UPDATE/DELETE policies
       for `authenticated`/`anon` — all writes go through SECURITY DEFINER
       RPCs (`credit_cashback_for_order`, and the redemption block inside
       `create_order_complete`) or the webhook's service-role client, same
       pattern as `coupon_usages`.
*/

CREATE TABLE IF NOT EXISTS cashback_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, store_owner_id)
);

CREATE TABLE IF NOT EXISTS cashback_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('earned', 'redeemed')),
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cashback_tx_earned_once_per_order
  ON cashback_transactions (order_id) WHERE type = 'earned';

CREATE UNIQUE INDEX IF NOT EXISTS cashback_tx_redeemed_once_per_order
  ON cashback_transactions (order_id) WHERE type = 'redeemed';

CREATE INDEX IF NOT EXISTS cashback_balances_customer_idx ON cashback_balances (customer_id);
CREATE INDEX IF NOT EXISTS cashback_transactions_customer_idx ON cashback_transactions (customer_id);

ALTER TABLE cashback_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own cashback balance" ON cashback_balances;
CREATE POLICY "Customers can view own cashback balance"
  ON cashback_balances FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can view own cashback transactions" ON cashback_transactions;
CREATE POLICY "Customers can view own cashback transactions"
  ON cashback_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashback_used numeric NOT NULL DEFAULT 0;
