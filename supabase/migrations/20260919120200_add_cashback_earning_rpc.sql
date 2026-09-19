/*
  # Add credit_cashback_for_order RPC (cashback earning on payment approval)

  1. Problem
     - Cashback must be credited only once real money is confirmed received
       — the payment webhook's "approved" branch is the only trustworthy
       signal for that, the same reasoning that already gates real stock
       deduction there instead of at order creation.

  2. Fix
     - `credit_cashback_for_order(p_order_id, p_payment_id)`: looks up the
       order (buyer, store, type) and the actual amount charged
       (`order_payments.amount_cents` — already net of any coupon/payment
       discount/cashback redeemed on this same order, since that's what
       Mercado Pago actually charged), reads the merchant's
       `cashback.enabled`/`percentageRate` from
       `user_storefront_settings.settings` (same JSONB read pattern
       `reserve_stock_for_order` already uses for `enableInventory`), and
       credits `cashback_balances` — idempotent via the partial unique
       index on `cashback_transactions(order_id) WHERE type = 'earned'`.
     - No-ops (returns `credited: false`) for non-ecommerce orders, orders
       with no logged-in buyer, or when the merchant has cashback off —
       never raises, so a webhook call to this RPC can't fail the payment
       approval response.
*/

CREATE OR REPLACE FUNCTION public.credit_cashback_for_order(p_order_id uuid, p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order RECORD;
  v_amount_cents integer;
  v_settings jsonb;
  v_enabled boolean;
  v_rate numeric;
  v_amount numeric;
  v_inserted integer;
BEGIN
  SELECT id, store_owner_id, buyer_id, order_type
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF v_order IS NULL OR v_order.buyer_id IS NULL OR v_order.order_type <> 'ecommerce' THEN
    RETURN jsonb_build_object('success', true, 'credited', false);
  END IF;

  SELECT amount_cents INTO v_amount_cents
  FROM order_payments
  WHERE id = p_payment_id AND order_id = p_order_id;

  IF v_amount_cents IS NULL OR v_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', true, 'credited', false);
  END IF;

  SELECT settings INTO v_settings
  FROM user_storefront_settings
  WHERE user_id = v_order.store_owner_id;

  v_enabled := COALESCE((v_settings->'cashback'->>'enabled')::boolean, false);
  v_rate := COALESCE((v_settings->'cashback'->>'percentageRate')::numeric, 0);

  IF NOT v_enabled OR v_rate <= 0 THEN
    RETURN jsonb_build_object('success', true, 'credited', false);
  END IF;

  v_amount := ROUND((v_amount_cents / 100.0) * (v_rate / 100), 2);

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'credited', false);
  END IF;

  INSERT INTO cashback_transactions (customer_id, store_owner_id, order_id, type, amount)
  VALUES (v_order.buyer_id, v_order.store_owner_id, p_order_id, 'earned', v_amount)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    INSERT INTO cashback_balances (customer_id, store_owner_id, balance)
    VALUES (v_order.buyer_id, v_order.store_owner_id, v_amount)
    ON CONFLICT (customer_id, store_owner_id)
    DO UPDATE SET balance = cashback_balances.balance + EXCLUDED.balance, updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'credited', v_inserted > 0, 'amount', v_amount);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.credit_cashback_for_order TO service_role;
