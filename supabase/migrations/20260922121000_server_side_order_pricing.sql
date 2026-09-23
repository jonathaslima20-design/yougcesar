/*
  # Recompute order pricing server-side instead of trusting the client

  1. Problem
     - `create_order_complete` inserted whatever `p_total` / `p_subtotal` /
       per-item `unit_price` the client sent, with orders/order_items INSERT
       policies open to anon+authenticated (`WITH CHECK (true)`). A
       manipulated client could create a real order — real stock
       reservation, real Mercado Pago charge for `transaction_amount:
       order.total` — for a fraction of the actual price of the cart, down
       to any amount including near-zero.
     - The coupon discount calculation had the same gap one level removed:
       `compute_coupon_discount` was called with the client's own
       `p_subtotal` and the client's own per-item `subtotal` fields inside
       `p_items`, so even fixing the order total alone would have left a
       second lever — inflate the item subtotals fed into a percentage
       coupon to produce a discount bigger than the (now correctly
       computed) real subtotal.

  2. Fix
     - New helper `resolve_order_item_price(product_id, quantity,
       selected_variant_label)` mirrors the exact price-selection priority
       the frontend already uses (`applied_tier_price || discounted_price
       || price`, see src/lib/cartUtils.ts): weight-variant price by label
       (product_weight_variants.label is unique per product) > quantity
       tier (product_price_tiers) > product base/discounted price. Never
       trusts client-sent unit_price.
     - `create_order_complete` now resolves every item's price through
       that helper, accumulates the authoritative subtotal from it, builds
       the coupon-eligibility items array from those authoritative
       per-item subtotals (not the client's), and calls
       `compute_coupon_discount` with the authoritative subtotal — closing
       both levers at once.
     - The final total is recomputed server-side with the same formula the
       two checkout flows already use (CheckoutAddressPage.tsx /
       CartModal.tsx, identical up to payment_method_discount which is 0
       for the ecommerce flow): subtotal - discount - cashback +
       delivery_fee + insurance_fee - payment_method_discount, floored at
       0.
     - `delivery_fee` and `insurance_fee` remain client-supplied and are
       NOT revalidated here — same trust model the distance/weight
       migration already documented for delivery_fee. Recomputing shipping
       quotes (SuperFrete / distance-tier / weight-tier) and the insurance
       percentage server-side is a separate, larger piece of work, not
       included in this pass. Known residual risk, not a silent gap.
     - Coupon usage bookkeeping (coupon_usages insert + current_uses
       increment) now only happens immediately here for orders that are
       final at creation time (`order_type != 'ecommerce' OR
       payment_status != 'pending'`). For ecommerce orders awaiting online
       payment, it's deferred to `process_order_payment_result` (see
       20260922122000) so an abandoned/rejected payment never burns a
       coupon use — the discount is still applied to this order's total
       either way, only the usage counter waits for actual payment.
*/

CREATE OR REPLACE FUNCTION public.resolve_order_item_price(
  p_product_id uuid,
  p_quantity integer,
  p_selected_variant_label text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_weight_variant RECORD;
  v_tier RECORD;
  v_product RECORD;
BEGIN
  IF p_selected_variant_label IS NOT NULL THEN
    SELECT price, discounted_price INTO v_weight_variant
    FROM product_weight_variants
    WHERE product_id = p_product_id AND label = p_selected_variant_label
    LIMIT 1;

    IF FOUND THEN
      RETURN COALESCE(v_weight_variant.discounted_price, v_weight_variant.price);
    END IF;
  END IF;

  SELECT unit_price, discounted_unit_price INTO v_tier
  FROM product_price_tiers
  WHERE product_id = p_product_id
    AND min_quantity <= p_quantity
    AND (max_quantity IS NULL OR max_quantity >= p_quantity)
  ORDER BY min_quantity DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_tier.discounted_unit_price, v_tier.unit_price);
  END IF;

  SELECT price, discounted_price INTO v_product
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado: %', p_product_id;
  END IF;

  RETURN COALESCE(v_product.discounted_price, v_product.price);
END;
$function$;

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
  p_cashback_used numeric DEFAULT 0,
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
  v_cashback_balance numeric := 0;
  v_effective_cashback_used numeric := 0;
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

  -- Cashback redemption: never trust the client's number outright. Lock
  -- the buyer's real balance for this store and clamp to what's actually
  -- available and actually owed.
  IF p_cashback_used > 0 AND p_buyer_id IS NOT NULL THEN
    SELECT balance INTO v_cashback_balance
    FROM cashback_balances
    WHERE customer_id = p_buyer_id AND store_owner_id = p_store_owner_id
    FOR UPDATE;

    v_effective_cashback_used := LEAST(
      COALESCE(v_cashback_balance, 0),
      GREATEST(p_cashback_used, 0),
      GREATEST(v_authoritative_subtotal - v_effective_discount, 0)
    );
  END IF;

  -- delivery_fee/insurance_fee remain client-supplied (same trust model as
  -- before this migration — recomputing shipping quotes/insurance
  -- server-side is out of scope here). Only the product-derived portion of
  -- the total is now authoritative.
  v_authoritative_total := GREATEST(
    0,
    v_authoritative_subtotal
      - v_effective_discount
      - v_effective_cashback_used
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
    cashback_used,
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
    v_effective_cashback_used,
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

  IF v_effective_cashback_used > 0 THEN
    UPDATE cashback_balances
    SET balance = balance - v_effective_cashback_used, updated_at = now()
    WHERE customer_id = p_buyer_id AND store_owner_id = p_store_owner_id;

    INSERT INTO cashback_transactions (customer_id, store_owner_id, order_id, type, amount)
    VALUES (p_buyer_id, p_store_owner_id, v_order_id, 'redeemed', v_effective_cashback_used);
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
