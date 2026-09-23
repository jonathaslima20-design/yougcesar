/*
  # Unify payment-result processing into one locked, idempotent RPC

  1. Problem
     - Three different code paths independently write order_payments.status /
       orders.payment_status and independently decide whether to deduct
       stock / credit cashback / release a reservation: the webhook
       (merchant-payment-webhook/index.ts), the buyer's own status polling
       (merchant-payments/index.ts getPaymentStatus), and the synchronous
       result of createPixPayment/createCardPayment in the same file.
     - Each of them guards against double-processing with its own
       `paymentRow.status !== "approved"` check read *before* any lock is
       taken, so two of these paths racing on the same payment (most
       commonly: the buyer's polling loop and the webhook both learning
       "approved" seconds apart) can both pass their own guard. Whichever
       one runs first wins and the other silently no-ops its side effects
       — in the observed case, the poller marks the order approved without
       ever calling deduct_stock_for_order/credit_cashback_for_order, and
       by the time the webhook arrives paymentRow.status is already
       "approved" so its own guard skips the real processing entirely.
       Stock reservation leaks forever, cashback is never credited.
     - Separately, createCardPayment's own synchronous "approved" branch
       has the exact same gap: it flips orders.payment_status to approved
       but never deducts stock or credits cashback at all — today no
       card payment approved synchronously ever deducts stock.

  2. Fix
     - `process_order_payment_result` is the single place any of those
       three callers write a payment result through from now on. It locks
       the order_payments row (`FOR UPDATE`), compares the stored status to
       the incoming one, and only when that is a real transition does it
       do anything — so no matter which caller reaches it first, or how
       many call it with the same status, the stock/cashback side effects
       run exactly once.
     - Approved-for-the-first-time: flips orders.payment_status, deducts
       stock (mirroring deductStockForApprovedOrder's own settings-gated
       logic, now done in the same transaction as the lock instead of a
       second round trip), credits cashback.
     - First negative terminal status coming from pending: releases the
       stock reservation.
     - Everything else (duplicate status, terminal->terminal like
       rejected->cancelled) is a no-op.
     - Chargeback/refund reversal (restoring stock after an approval is
       later reversed) is intentionally NOT handled here yet — out of
       scope for this change, still whatever the webhook did before.
*/

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
    SELECT id, store_owner_id, payment_status, inventory_deducted
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
