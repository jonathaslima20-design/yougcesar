-- Remove cashback from the order RPCs (step 2 of 3).
--
-- create_order_complete: stops reading p_cashback_used, stops debiting
-- cashback_balances and stops writing orders.cashback_used. The parameter stays in
-- the signature so clients that still send it keep working; it is ignored.
-- process_order_payment_result: no longer credits cashback on payment approval.
-- Both bodies are the latest versions (20260922121000 and 20260922122000) with the
-- cashback parts removed. Step 3 drops the tables and the credit function.

CREATE OR REPLACE FUNCTION public.create_order_complete(
  p_store_owner_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_customer_country_code text DEFAULT '55',
  p_order_type text DEFAULT 'whatsapp',
  p_subtotal numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_whatsapp_message text DEFAULT '',
  p_source text DEFAULT 'cart',
  p_coupon_id uuid DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT NULL,
  p_payment_method_discount numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_delivery_option text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_buyer_id uuid DEFAULT NULL,
  p_payment_status text DEFAULT 'not_applicable',
  p_shipping_street text DEFAULT NULL,
  p_shipping_number text DEFAULT NULL,
  p_shipping_complement text DEFAULT NULL,
  p_shipping_neighborhood text DEFAULT NULL,
  p_shipping_city text DEFAULT NULL,
  p_shipping_state text DEFAULT NULL,
  p_shipping_zip_code text DEFAULT NULL,
  p_insurance_fee numeric DEFAULT 0,
  p_affiliate_id uuid DEFAULT NULL,
  p_delivery_scope text DEFAULT NULL,
  p_delivery_is_quote boolean DEFAULT false,
  p_pickup_instructions text DEFAULT NULL,
  p_customer_cpf text DEFAULT NULL,
  p_cashback_used numeric DEFAULT 0, -- ignored; kept so existing clients keep working until the next cleanup
  p_delivery_distance_km numeric DEFAULT NULL,
  p_delivery_weight_kg numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_affiliate_id uuid := p_affiliate_id;
  v_item_product_ids uuid[];
  v_coupon_result jsonb;
  v_effective_coupon_id uuid := NULL;
  v_effective_coupon_code text := NULL;
  v_effective_discount numeric := 0;
  v_resolved_price numeric;
  v_item_quantity integer;
  v_item_line_subtotal numeric;
  v_authoritative_subtotal numeric := 0;
  v_authoritative_total numeric := 0;
  v_coupon_items jsonb := '[]'::jsonb;
  v_defer_coupon_usage boolean;
BEGIN
  IF v_affiliate_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.affiliates a
      JOIN public.users u ON u.id = a.store_owner_id
      WHERE a.id = v_affiliate_id
        AND a.store_owner_id = p_store_owner_id
        AND a.status = 'active'
        AND u.affiliate_program_enabled = true
    ) THEN
      v_affiliate_id := NULL;
    END IF;
  END IF;

  -- Resolve every item's authoritative price server-side, building both
  -- the coupon-eligibility array (product_id/subtotal, same shape
  -- compute_coupon_discount already expects) and the real subtotal — never
  -- from the client's own unit_price/subtotal.
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);
      v_resolved_price := public.resolve_order_item_price(
        (v_item->>'product_id')::uuid,
        v_item_quantity,
        v_item->>'selected_variant_label'
      );
      v_item_line_subtotal := v_resolved_price * v_item_quantity;
      v_authoritative_subtotal := v_authoritative_subtotal + v_item_line_subtotal;

      v_coupon_items := v_coupon_items || jsonb_build_object(
        'product_id', v_item->>'product_id',
        'subtotal', v_item_line_subtotal
      );
    END LOOP;
  END IF;

  -- Re-check the coupon against the actual items being purchased right
  -- now, instead of trusting whatever the client validated earlier —
  -- the cart may have changed since, or the coupon may have expired,
  -- been deactivated, or hit its usage cap in the meantime. Uses the
  -- authoritative subtotal/items resolved above, not the client's.
  IF p_coupon_id IS NOT NULL THEN
    SELECT ARRAY_AGG((item->>'product_id')::uuid) INTO v_item_product_ids
    FROM jsonb_array_elements(p_items) AS item;

    v_coupon_result := public.compute_coupon_discount(
      p_coupon_id,
      p_customer_whatsapp,
      v_authoritative_subtotal,
      COALESCE(v_item_product_ids, '{}'::uuid[]),
      v_coupon_items
    );

    IF COALESCE((v_coupon_result->>'valid')::boolean, false) THEN
      v_effective_coupon_id := p_coupon_id;
      v_effective_coupon_code := p_coupon_code;
      v_effective_discount := (v_coupon_result->>'calculated_discount')::numeric;
    END IF;
  END IF;

  -- delivery_fee/insurance_fee remain client-supplied (same trust model as
  -- before this migration — recomputing shipping quotes/insurance
  -- server-side is out of scope here). Only the product-derived portion of
  -- the total is now authoritative.
  v_authoritative_total := GREATEST(
    0,
    v_authoritative_subtotal
      - v_effective_discount
      + COALESCE(p_delivery_fee, 0)
      + COALESCE(p_insurance_fee, 0)
      - COALESCE(p_payment_method_discount, 0)
  );

  -- WhatsApp orders (and any order that isn't an ecommerce payment still
  -- pending) commit the coupon usage immediately, same as before. Ecommerce
  -- orders awaiting online payment defer it to payment approval.
  v_defer_coupon_usage := (p_order_type = 'ecommerce' AND p_payment_status = 'pending');

  INSERT INTO orders (
    store_owner_id,
    customer_name,
    customer_whatsapp,
    customer_country_code,
    order_type,
    subtotal,
    total,
    notes,
    whatsapp_message,
    source,
    coupon_id,
    coupon_code,
    discount_amount,
    payment_method,
    payment_method_discount,
    delivery_fee,
    delivery_option,
    buyer_id,
    payment_status,
    shipping_street,
    shipping_number,
    shipping_complement,
    shipping_neighborhood,
    shipping_city,
    shipping_state,
    shipping_zip_code,
    insurance_fee,
    affiliate_id,
    delivery_scope,
    delivery_is_quote,
    pickup_instructions,
    customer_cpf,
    delivery_distance_km,
    delivery_weight_kg
  ) VALUES (
    p_store_owner_id,
    p_customer_name,
    p_customer_whatsapp,
    p_customer_country_code,
    p_order_type,
    v_authoritative_subtotal,
    v_authoritative_total,
    p_notes,
    p_whatsapp_message,
    p_source,
    v_effective_coupon_id,
    v_effective_coupon_code,
    v_effective_discount,
    p_payment_method,
    p_payment_method_discount,
    p_delivery_fee,
    p_delivery_option,
    p_buyer_id,
    p_payment_status,
    p_shipping_street,
    p_shipping_number,
    p_shipping_complement,
    p_shipping_neighborhood,
    p_shipping_city,
    p_shipping_state,
    p_shipping_zip_code,
    p_insurance_fee,
    v_affiliate_id,
    p_delivery_scope,
    p_delivery_is_quote,
    p_pickup_instructions,
    p_customer_cpf,
    p_delivery_distance_km,
    p_delivery_weight_kg
  )
  RETURNING id INTO v_order_id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);
      v_resolved_price := public.resolve_order_item_price(
        (v_item->>'product_id')::uuid,
        v_item_quantity,
        v_item->>'selected_variant_label'
      );

      INSERT INTO order_items (
        order_id,
        product_id,
        product_title,
        product_image_url,
        quantity,
        unit_price,
        selected_color,
        selected_size,
        selected_flavor,
        selected_variant_label,
        item_notes,
        subtotal
      ) VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        COALESCE(v_item->>'product_title', ''),
        COALESCE(v_item->>'product_image_url', ''),
        v_item_quantity,
        v_resolved_price,
        v_item->>'selected_color',
        v_item->>'selected_size',
        v_item->>'selected_flavor',
        v_item->>'selected_variant_label',
        COALESCE(v_item->>'item_notes', ''),
        v_resolved_price * v_item_quantity
      );
    END LOOP;
  END IF;

  -- Reserve stock for ecommerce orders awaiting payment — WhatsApp orders
  -- (payment_status stays at its 'not_applicable' default) deduct real
  -- stock immediately via their own separate path and never reserve.
  -- A stock failure here rolls back the whole function (order, items, and
  -- any partial reservation already applied), caught by the EXCEPTION
  -- block below — the coupon usage insert further down never runs.
  IF p_payment_status = 'pending' AND p_order_type = 'ecommerce' THEN
    PERFORM public.reserve_stock_for_order(v_order_id);
  END IF;

  IF v_effective_coupon_id IS NOT NULL AND NOT v_defer_coupon_usage THEN
    INSERT INTO coupon_usages (
      coupon_id,
      customer_whatsapp,
      discount_applied,
      used_at,
      order_id
    ) VALUES (
      v_effective_coupon_id,
      p_customer_whatsapp,
      v_effective_discount,
      now(),
      v_order_id
    );

    UPDATE coupons
    SET current_uses = current_uses + 1
    WHERE id = v_effective_coupon_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'subtotal', v_authoritative_subtotal,
    'total', v_authoritative_total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_order_item_price(uuid, integer, text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_complete(
  uuid, text, text, text, text, numeric, numeric, text, text, text,
  uuid, text, numeric, text, numeric, numeric, text, jsonb, uuid, text,
  text, text, text, text, text, text, text, numeric, uuid, text,
  boolean, text, text, numeric, numeric, numeric
) TO anon, authenticated;

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
