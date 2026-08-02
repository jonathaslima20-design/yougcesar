/*
  # Create affiliate_commissions ledger + generation/reversal trigger

  1. Problem
    - Once an order is attributed to an affiliate (orders.affiliate_id, added
      in the previous migration of this batch), a commission needs to be
      calculated and recorded automatically, at line-item granularity (a
      cart can mix products from categories with different commission
      rates, so a single flat rate per order would be wrong/unauditable),
      and reversed (never deleted) if the sale later falls through.

  2. New Tables
    - `affiliate_commissions`: one row per order_item that had an affiliate
      attached at generation time. Snapshots `commission_percentage` and
      `commission_amount` at generation time (immune to the affiliate's
      rate/rules changing afterwards), mirroring the audit-snapshot pattern
      already used by `partner_commissions`
      (20260725000300_create_partner_commissions.sql). `affiliate_id` is
      ON DELETE SET NULL (not CASCADE) so the ledger survives even if the
      affiliate is later removed — store_owner_id is denormalized for the
      same reason `order_payments.store_owner_id` is (RLS/index), and
      product_name_snapshot/category_matched are frozen text, not FKs.
      `UNIQUE (order_item_id)` makes the trigger idempotent against retries.

  3. Trigger: `handle_affiliate_commission_on_order_change`
    - Fires `AFTER UPDATE ON orders`. No-ops immediately if the order has no
      `affiliate_id`.
    - Self-purchase guard: if `buyer_id = affiliate_id` (the same person
      bought through their own link — possible because, like `customers`,
      nothing stops one `auth.users` id from having both a buyer and an
      affiliate profile), no commission is ever generated. This is the
      single most obvious fraud vector in the whole feature and is closed
      here, at the one place all commission generation flows through.
    - Generation trigger differs by `order_type` (confirmed product
      decisions):
      - `ecommerce`: generates when `payment_status` transitions to `'paid'`
        — objective signal, not configurable.
      - `whatsapp`: no online payment confirmation exists in this flow, so
        the merchant chooses the trigger status ('confirmed' or 'delivered')
        per store, stored at `user_storefront_settings.settings.affiliate
        .commissionTrigger` (defaults to 'delivered' if never configured).
        Generates when `orders.status` transitions into that chosen status.
    - Reversal (never delete): flips existing `pending` rows for the order to
      `reversed` when `payment_status` transitions to `'refunded'`
      (ecommerce) or `status` transitions to `'cancelled'` (whatsapp).
    - Category matching: for each order_item, resolves the product's
      `category` (text[] of names — products have no `category_id` FK, see
      the note in 20260802020000_create_affiliates_and_commission_rules.sql)
      and takes the HIGHEST `commission_percentage` among the affiliate's
      `affiliate_commission_rules` whose `category_name` is in that array
      (confirmed tie-break rule). Falls back to
      `affiliates.default_commission_percentage` if no category rule
      matches.
    - `SECURITY DEFINER` so it can read/write `affiliate_commissions`
      regardless of who triggered the order update, same as the partner
      commission trigger.

  4. `orders` DELETE policy — commission-associated orders are protected
    - Confirmed product decision: absolute block, not a "reverse first" extra
      step. A store owner can no longer delete an order that has ANY row in
      `affiliate_commissions` (regardless of that row's status, including
      already-`reversed` ones) — once a commission existed for an order, the
      order becomes permanent for audit purposes. The correct way to undo a
      bad order is to cancel it, which the trigger above already reverses
      automatically.
*/

CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  store_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id),
  product_name_snapshot text,
  category_matched text,
  item_subtotal numeric NOT NULL DEFAULT 0,
  commission_percentage numeric NOT NULL,
  commission_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  reversed_at timestamptz,
  UNIQUE (order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_store_owner_id ON public.affiliate_commissions (store_owner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_order_id ON public.affiliate_commissions (order_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON public.affiliate_commissions (status);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view own commissions" ON public.affiliate_commissions;
CREATE POLICY "Affiliates can view own commissions"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

DROP POLICY IF EXISTS "Store owners can view own commissions ledger" ON public.affiliate_commissions;
CREATE POLICY "Store owners can view own commissions ledger"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (store_owner_id = auth.uid());

-- Store owners may only flip status (e.g. mark as paid) — inserts happen
-- exclusively through the SECURITY DEFINER trigger below, which bypasses RLS.
DROP POLICY IF EXISTS "Store owners can update own commissions status" ON public.affiliate_commissions;
CREATE POLICY "Store owners can update own commissions status"
  ON public.affiliate_commissions FOR UPDATE
  TO authenticated
  USING (store_owner_id = auth.uid())
  WITH CHECK (store_owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all affiliate commissions" ON public.affiliate_commissions;
CREATE POLICY "Admins can manage all affiliate commissions"
  ON public.affiliate_commissions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_affiliate_commission_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_generate boolean := false;
  v_should_reverse boolean := false;
  v_commission_trigger text;
  v_item record;
  v_best_rate numeric;
  v_default_rate numeric;
BEGIN
  IF NEW.affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Self-purchase guard: never generate or keep a commission when the buyer
  -- and the affiliate are the same identity (bought through their own link).
  IF NEW.buyer_id IS NOT NULL AND NEW.buyer_id = NEW.affiliate_id THEN
    RETURN NEW;
  END IF;

  IF NEW.order_type = 'ecommerce' THEN
    IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
      v_should_generate := true;
    END IF;
    IF NEW.payment_status = 'refunded' AND (OLD.payment_status IS DISTINCT FROM 'refunded') THEN
      v_should_reverse := true;
    END IF;
  ELSE
    SELECT COALESCE(uss.settings #>> '{affiliate,commissionTrigger}', 'delivered')
      INTO v_commission_trigger
      FROM public.user_storefront_settings uss
      WHERE uss.user_id = NEW.store_owner_id;

    v_commission_trigger := COALESCE(v_commission_trigger, 'delivered');

    IF NEW.status = v_commission_trigger AND (OLD.status IS DISTINCT FROM v_commission_trigger) THEN
      v_should_generate := true;
    END IF;
    IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
      v_should_reverse := true;
    END IF;
  END IF;

  IF v_should_generate THEN
    SELECT default_commission_percentage INTO v_default_rate
    FROM public.affiliates WHERE id = NEW.affiliate_id;

    IF v_default_rate IS NOT NULL THEN
      FOR v_item IN
        SELECT oi.id, oi.product_title, oi.subtotal, p.category
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id
      LOOP
        v_best_rate := NULL;

        IF v_item.category IS NOT NULL THEN
          SELECT MAX(acr.commission_percentage) INTO v_best_rate
          FROM public.affiliate_commission_rules acr
          WHERE acr.affiliate_id = NEW.affiliate_id
            AND acr.category_name = ANY(v_item.category);
        END IF;

        INSERT INTO public.affiliate_commissions (
          affiliate_id, store_owner_id, order_id, order_item_id,
          product_name_snapshot, category_matched, item_subtotal,
          commission_percentage, commission_amount
        ) VALUES (
          NEW.affiliate_id, NEW.store_owner_id, NEW.id, v_item.id,
          v_item.product_title,
          CASE WHEN v_best_rate IS NOT NULL THEN
            (SELECT acr.category_name FROM public.affiliate_commission_rules acr
             WHERE acr.affiliate_id = NEW.affiliate_id
               AND acr.category_name = ANY(v_item.category)
               AND acr.commission_percentage = v_best_rate
             LIMIT 1)
          ELSE NULL END,
          v_item.subtotal,
          COALESCE(v_best_rate, v_default_rate),
          ROUND(v_item.subtotal * (COALESCE(v_best_rate, v_default_rate) / 100), 2)
        )
        ON CONFLICT (order_item_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  IF v_should_reverse THEN
    UPDATE public.affiliate_commissions
    SET status = 'reversed', reversed_at = now()
    WHERE order_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_affiliate_commission_on_order_change ON public.orders;
CREATE TRIGGER trigger_affiliate_commission_on_order_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_affiliate_commission_on_order_change();

-- Protect orders that already have a commission record from deletion.
DROP POLICY IF EXISTS "Store owners can delete own orders" ON public.orders;
CREATE POLICY "Store owners can delete own orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (
    auth.uid() = store_owner_id
    AND NOT EXISTS (
      SELECT 1 FROM public.affiliate_commissions ac WHERE ac.order_id = orders.id
    )
  );
