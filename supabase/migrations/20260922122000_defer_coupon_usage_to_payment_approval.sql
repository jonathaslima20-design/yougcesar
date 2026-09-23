/*
  # Defer coupon usage counting to payment approval (items 10 & 11)

  1. Problem
     - `create_order_complete` recorded coupon usage (coupon_usages insert +
       coupons.current_uses increment) unconditionally at order creation,
       even for ecommerce orders that still needed online payment. An
       abandoned Pix or a rejected card permanently burned that use —
       a customer with `max_uses_per_customer = 1` who abandons once can
       never use the coupon again, and a global `max_uses` coupon loses a
       real unit of its cap on every abandoned attempt.
     - The increment also happened with no lock on the coupon row, so two
       concurrent checkouts on the last remaining use could both pass the
       `current_uses < max_uses` check and both increment, overselling the
       coupon's cap.

  2. Fix
     - 20260922121000 already changed create_order_complete to skip the
       immediate coupon_usages insert for ecommerce orders with
       payment_status = 'pending' (v_defer_coupon_usage). The discount is
       still computed and applied to the order's total right away — only
       the usage bookkeeping is deferred.
     - This migration adds the deferred half: process_order_payment_result
       (20260922120000) now consumes the coupon — under a row lock on the
       coupon itself, re-validating current_uses/max_uses_per_customer at
       the one moment that actually matters (the payment is really being
       committed) — right after it deducts stock/credits cashback on a
       fresh transition into 'approved'. If the cap was hit by someone else
       in the meantime, this order keeps the discount the buyer already
       paid (no retroactive charge), it just doesn't count against the
       cap — same trade-off create_order_complete already makes when a
       coupon stops validating between cart and checkout.
     - `coupon_usages.order_id` is added so the deferred path (and any
       future auditing) can tell which order a usage row belongs to, and
       so a re-invocation of process_order_payment_result for the same
       order can't double-insert a usage row for it.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coupon_usages' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE public.coupon_usages
      ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id ON public.coupon_usages (order_id);

CREATE OR REPLACE FUNCTION public.process_order_payment_result(
  p_order_payment_id uuid,
  p_mp_status text,
  p_status_detail text DEFAULT '',
  p_raw_response jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_payment RECORD;
  v_order RECORD;
  v_settings RECORD;
  v_items jsonb;
  v_was_new_transition boolean := false;
  v_coupon RECORD;
  v_customer_uses integer;
BEGIN
  SELECT id, order_id, store_owner_id, status
  INTO v_payment
  FROM order_payments
  WHERE id = p_order_payment_id
  FOR UPDATE;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_payment not found');
  END IF;

  -- Nothing changed since the last time someone recorded a result for
  -- this payment — whoever called us lost the race, and that's fine.
  IF v_payment.status IS NOT DISTINCT FROM p_mp_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', v_payment.status,
      'was_new_transition', false
    );
  END IF;

  UPDATE order_payments
  SET status = p_mp_status,
      status_detail = COALESCE(p_status_detail, status_detail),
      raw_response = COALESCE(p_raw_response, raw_response),
      updated_at = now()
  WHERE id = v_payment.id;

  v_was_new_transition := true;

  IF p_mp_status = 'approved' THEN
    SELECT id, store_owner_id, payment_status, inventory_deducted,
           coupon_id, discount_amount, customer_whatsapp
    INTO v_order
    FROM orders
    WHERE id = v_payment.order_id
    FOR UPDATE;

    IF v_order.payment_status IS DISTINCT FROM 'approved' THEN
      UPDATE orders SET payment_status = 'approved' WHERE id = v_order.id;
    END IF;

    IF NOT COALESCE(v_order.inventory_deducted, false) THEN
      SELECT settings INTO v_settings
      FROM user_storefront_settings
      WHERE user_id = v_order.store_owner_id;

      IF COALESCE((v_settings.settings->>'enableInventory')::boolean, false)
         AND COALESCE((v_settings.settings->>'autoDeductStock')::boolean, true) THEN
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', product_id,
          'quantity', quantity,
          'selected_color', selected_color,
          'selected_size', selected_size,
          'selected_flavor', selected_flavor,
          'selected_variant_label', selected_variant_label
        )) INTO v_items
        FROM order_items
        WHERE order_id = v_order.id;

        IF v_items IS NOT NULL THEN
          PERFORM public.deduct_stock_for_order(v_order.id, v_order.store_owner_id, v_items);
        END IF;
      END IF;
    END IF;

    -- Best-effort: cashback is a bonus, never allowed to fail the payment
    -- confirmation itself.
    BEGIN
      PERFORM public.credit_cashback_for_order(v_order.id, v_payment.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'credit_cashback_for_order failed for order %: %', v_order.id, SQLERRM;
    END;

    -- Deferred coupon usage: this order's discount was already applied to
    -- its total at creation time (create_order_complete). What's deferred
    -- is only the bookkeeping — the usage row and the cap counter — to
    -- the moment the payment is actually confirmed, and re-validated here
    -- under lock instead of blindly trusting the creation-time check.
    IF v_order.coupon_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM coupon_usages WHERE order_id = v_order.id) THEN
      SELECT id, current_uses, max_uses, max_uses_per_customer
      INTO v_coupon
      FROM coupons
      WHERE id = v_order.coupon_id
      FOR UPDATE;

      IF FOUND THEN
        v_customer_uses := NULL;
        IF v_coupon.max_uses_per_customer IS NOT NULL AND COALESCE(v_order.customer_whatsapp, '') != '' THEN
          SELECT COUNT(*) INTO v_customer_uses
          FROM coupon_usages
          WHERE coupon_id = v_coupon.id
            AND customer_whatsapp = v_order.customer_whatsapp;
        END IF;

        IF (v_coupon.max_uses IS NULL OR v_coupon.current_uses < v_coupon.max_uses)
           AND (v_customer_uses IS NULL OR v_customer_uses < v_coupon.max_uses_per_customer) THEN
          INSERT INTO coupon_usages (coupon_id, customer_whatsapp, discount_applied, used_at, order_id)
          VALUES (v_coupon.id, v_order.customer_whatsapp, v_order.discount_amount, now(), v_order.id);

          UPDATE coupons SET current_uses = current_uses + 1 WHERE id = v_coupon.id;
        END IF;
        -- Cap already hit by someone else in the meantime: this order keeps
        -- its already-paid discount, just doesn't count against the cap.
      END IF;
    END IF;

  ELSIF p_mp_status IN ('rejected', 'cancelled') AND v_payment.status IS DISTINCT FROM 'approved' THEN
    -- First time this payment lands on a negative terminal status, and it
    -- was never approved before — free the stock reservation for someone
    -- else. (A negative status arriving *after* a prior approval, e.g. a
    -- reversal, is out of scope here — left to existing webhook handling.)
    PERFORM public.release_order_stock_reservation(v_payment.order_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', p_mp_status,
    'was_new_transition', v_was_new_transition
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_order_payment_result(uuid, text, text, jsonb) TO service_role;
