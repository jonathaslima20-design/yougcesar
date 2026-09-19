/*
  # Add cashback redemption to create_order_complete

  1. Problem
     - Cashback needs a way to be spent as a discount at checkout, following
       the same trust model already established for coupons: the client
       shows an estimate, but the database is the only source of truth for
       how much is actually applied and debited.

  2. Fix
     - `create_order_complete` gains `p_cashback_used numeric DEFAULT 0`.
       Right after the existing coupon re-validation block, it looks up the
       buyer's real balance in `cashback_balances` (`FOR UPDATE`, so two
       concurrent checkouts for the same buyer/store can't both spend the
       same balance) and clamps the applied amount to
       `LEAST(real balance, what the client asked for, subtotal after
       coupon discount)` — never trusting the client's number outright,
       mirroring how `compute_coupon_discount`'s result overrides
       `p_discount_amount`.
     - `orders.cashback_used` is set from this server-derived amount.
     - After the existing `coupon_usages` insert block, a matching block
       debits `cashback_balances` and records a `'redeemed'`
       `cashback_transactions` row when the effective amount is positive.
     - This is a straight `CREATE OR REPLACE` of the same function (not a
       new/forked copy) — it already runs inside one transaction with a
       blanket exception handler, so a cashback bug fails exactly like a
       coupon bug would today: caught, `{success:false}`, no partial state.
*/

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
  p_cashback_used numeric DEFAULT 0
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

  -- Re-check the coupon against the actual items being purchased right
  -- now, instead of trusting whatever the client validated earlier —
  -- the cart may have changed since, or the coupon may have expired,
  -- been deactivated, or hit its usage cap in the meantime.
  IF p_coupon_id IS NOT NULL THEN
    SELECT ARRAY_AGG((item->>'product_id')::uuid) INTO v_item_product_ids
    FROM jsonb_array_elements(p_items) AS item;

    v_coupon_result := public.compute_coupon_discount(
      p_coupon_id,
      p_customer_whatsapp,
      p_subtotal,
      COALESCE(v_item_product_ids, '{}'::uuid[]),
      p_items
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
      GREATEST(p_subtotal - v_effective_discount, 0)
    );
  END IF;

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
    cashback_used
  ) VALUES (
    p_store_owner_id,
    p_customer_name,
    p_customer_whatsapp,
    p_customer_country_code,
    p_order_type,
    p_subtotal,
    p_total,
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
    v_effective_cashback_used
  )
  RETURNING id INTO v_order_id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
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
        COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0),
        v_item->>'selected_color',
        v_item->>'selected_size',
        v_item->>'selected_flavor',
        v_item->>'selected_variant_label',
        COALESCE(v_item->>'item_notes', ''),
        COALESCE((v_item->>'subtotal')::numeric, 0)
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

  IF v_effective_coupon_id IS NOT NULL THEN
    INSERT INTO coupon_usages (
      coupon_id,
      customer_whatsapp,
      discount_applied,
      used_at
    ) VALUES (
      v_effective_coupon_id,
      p_customer_whatsapp,
      v_effective_discount,
      now()
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
    'order_id', v_order_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_order_complete TO anon, authenticated;
