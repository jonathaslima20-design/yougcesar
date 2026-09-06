/*
  # Reserve stock while an ecommerce order's payment is pending

  1. Problem
     - Stock is only deducted when Mercado Pago confirms payment (moved
       there specifically to avoid losing stock to an abandoned PIX or a
       declined card) — but that leaves the entire pending-payment window
       with zero protection: two buyers can generate a PIX for the same
       last unit at the same time, and whoever pays first gets it while
       the second buyer pays for a product that no longer exists.
     - `product_variant_stock.reserved_quantity` already exists and is
       already subtracted everywhere "available stock" is computed
       (`getAvailableVariantStock`, `getVariantStockStatus`,
       `findCartStockShortfalls`) — nothing writes a nonzero value into it
       today. A dead `stock_reservations`/session-based subsystem
       (`stockReservationService.ts`) was built for a different UX model
       (reserve on add-to-cart) and depends on a Postgres function that
       was never created — not reused here on purpose.

  2. Fix
     - `orders.stock_reserved_at`: NULL = no active reservation on this
       order; set once `reserve_stock_for_order` succeeds, cleared once
       the reservation is released or converted into a real deduction.
     - `reserve_stock_for_order(p_order_id)`: idempotent (no-op if already
       reserved, no-op if the store doesn't have inventory tracking with
       auto-deduct on — same two flags `merchant-payment-webhook` already
       gates real deduction on, so a reservation is never created where
       nothing would ever convert or release it). Only variant-tracked
       products are reserved (matches the existing limitation in
       `findCartStockShortfalls`). Raises on insufficient stock, letting
       the caller's own exception handling surface it — `create_order_complete`
       fails the whole order atomically (coupon usage included, since that
       runs after this call), edge functions get it back as an RPC error.
     - `release_order_stock_reservation(p_order_id)`: idempotent, gives
       the reserved quantity back and clears `stock_reserved_at`.
     - `create_order_complete`: calls `reserve_stock_for_order` right after
       inserting `order_items`, only for ecommerce orders born `pending`
       (WhatsApp orders never reserve — they deduct immediately via their
       existing separate path).
     - `deduct_stock_for_order`: when the payment is later approved and
       real stock is deducted, also releases the matching reservation
       amount in the same UPDATE (otherwise it stays double-counted
       forever) and clears `stock_reserved_at`.
*/

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_reserved_at timestamptz;

COMMENT ON COLUMN public.orders.stock_reserved_at IS
  'Set while this order holds an active stock reservation (payment still pending). NULL once released or converted into a real deduction.';

CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order RECORD;
  v_settings jsonb;
  v_inventory_enabled boolean;
  v_auto_deduct boolean;
  v_item RECORD;
  v_product RECORD;
  v_variant RECORD;
BEGIN
  SELECT id, store_owner_id, stock_reserved_at
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.stock_reserved_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reserved', true, 'already_reserved', true);
  END IF;

  SELECT settings INTO v_settings
  FROM user_storefront_settings
  WHERE user_id = v_order.store_owner_id;

  v_inventory_enabled := COALESCE((v_settings->>'enableInventory')::boolean, false);
  v_auto_deduct := COALESCE((v_settings->>'autoDeductStock')::boolean, true);

  IF NOT (v_inventory_enabled AND v_auto_deduct) THEN
    RETURN jsonb_build_object('success', true, 'reserved', false);
  END IF;

  FOR v_item IN
    SELECT product_id, quantity, selected_color, selected_size, selected_flavor
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    SELECT id, title, track_inventory
    INTO v_product
    FROM products
    WHERE id = v_item.product_id
    AND user_id = v_order.store_owner_id;

    IF v_product IS NULL OR NOT v_product.track_inventory THEN
      CONTINUE;
    END IF;

    SELECT id, quantity, reserved_quantity
    INTO v_variant
    FROM product_variant_stock
    WHERE product_id = v_product.id
    AND color IS NOT DISTINCT FROM v_item.selected_color
    AND size IS NOT DISTINCT FROM v_item.selected_size
    AND flavor IS NOT DISTINCT FROM v_item.selected_flavor
    LIMIT 1
    FOR UPDATE;

    -- No matching variant row (simple flat-stock product, or a combination
    -- that no longer exists in the grid): out of scope for reservation,
    -- same as findCartStockShortfalls already treats it.
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF (v_variant.quantity - v_variant.reserved_quantity) < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', v_product.title;
    END IF;

    UPDATE product_variant_stock
    SET reserved_quantity = reserved_quantity + v_item.quantity,
        updated_at = now()
    WHERE id = v_variant.id;
  END LOOP;

  UPDATE orders SET stock_reserved_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'reserved', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_order_stock_reservation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stock_reserved_at timestamptz;
  v_store_owner_id uuid;
  v_item RECORD;
  v_product RECORD;
  v_variant RECORD;
BEGIN
  SELECT stock_reserved_at, store_owner_id
  INTO v_stock_reserved_at, v_store_owner_id
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_stock_reserved_at IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_released', true);
  END IF;

  FOR v_item IN
    SELECT product_id, quantity, selected_color, selected_size, selected_flavor
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    SELECT id, track_inventory INTO v_product
    FROM products
    WHERE id = v_item.product_id AND user_id = v_store_owner_id;

    IF v_product IS NULL OR NOT v_product.track_inventory THEN
      CONTINUE;
    END IF;

    SELECT id, reserved_quantity INTO v_variant
    FROM product_variant_stock
    WHERE product_id = v_item.product_id
    AND color IS NOT DISTINCT FROM v_item.selected_color
    AND size IS NOT DISTINCT FROM v_item.selected_size
    AND flavor IS NOT DISTINCT FROM v_item.selected_flavor
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    UPDATE product_variant_stock
    SET reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
        updated_at = now()
    WHERE id = v_variant.id;
  END LOOP;

  UPDATE orders SET stock_reserved_at = NULL WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'released', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_stock_for_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock_reservation TO authenticated;

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
  p_customer_cpf text DEFAULT NULL
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
    customer_cpf
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
    p_customer_cpf
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

CREATE OR REPLACE FUNCTION public.deduct_stock_for_order(
  p_order_id uuid,
  p_store_owner_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_item jsonb;
  v_product RECORD;
  v_variant RECORD;
  v_quantity integer;
  v_prev_qty integer;
  v_new_qty integer;
  v_deduct_qty integer;
  v_current_stock integer;
  v_threshold integer;
  v_has_variant_rows boolean;
  v_had_reservation boolean;
  v_insufficient jsonb := '[]'::jsonb;
  v_unmatched jsonb := '[]'::jsonb;
  v_deducted_count integer := 0;
  v_shortfall jsonb;
BEGIN
SELECT stock_reserved_at IS NOT NULL INTO v_had_reservation FROM orders WHERE id = p_order_id;

FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
LOOP
  SELECT id, title, track_inventory, low_stock_threshold
  INTO v_product
  FROM products
  WHERE id = (v_item->>'product_id')::uuid
  AND user_id = p_store_owner_id;

  IF v_product IS NULL OR NOT v_product.track_inventory THEN
    CONTINUE;
  END IF;

  v_quantity := (v_item->>'quantity')::integer;

  SELECT * INTO v_variant
  FROM product_variant_stock
  WHERE product_id = v_product.id
  AND color IS NOT DISTINCT FROM (v_item->>'selected_color')
  AND size IS NOT DISTINCT FROM (v_item->>'selected_size')
  AND flavor IS NOT DISTINCT FROM (v_item->>'selected_flavor')
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_prev_qty := v_variant.quantity;
    v_deduct_qty := LEAST(v_quantity, GREATEST(v_prev_qty, 0));
    v_new_qty := v_prev_qty - v_deduct_qty;

    IF v_deduct_qty < v_quantity THEN
      v_insufficient := v_insufficient || jsonb_build_object(
        'product_id', v_product.id,
        'product_title', v_product.title,
        'variant_stock_id', v_variant.id,
        'selected_color', v_item->>'selected_color',
        'selected_size', v_item->>'selected_size',
        'selected_flavor', v_item->>'selected_flavor',
        'requested', v_quantity,
        'deducted', v_deduct_qty,
        'available', GREATEST(v_prev_qty, 0)
      );
    END IF;

    IF v_deduct_qty > 0 THEN
      -- If this order held a reservation, the reserved amount converts
      -- into the real deduction here instead of staying double-counted
      -- against future availability checks forever.
      UPDATE product_variant_stock
      SET quantity = v_new_qty,
          reserved_quantity = CASE WHEN v_had_reservation THEN GREATEST(0, reserved_quantity - v_quantity) ELSE reserved_quantity END,
          updated_at = now()
      WHERE id = v_variant.id;

      INSERT INTO stock_movements (
        product_id, variant_stock_id, movement_type, quantity,
        previous_quantity, new_quantity, reference_type, reference_id, performed_by
      ) VALUES (
        v_product.id, v_variant.id, 'saida', -v_deduct_qty,
        v_prev_qty, v_new_qty, 'order', p_order_id::text, p_store_owner_id
      );

      v_deducted_count := v_deducted_count + 1;
    END IF;

    PERFORM recalc_product_aggregate_stock(v_product.id);
  ELSE
    SELECT EXISTS (SELECT 1 FROM product_variant_stock WHERE product_id = v_product.id)
    INTO v_has_variant_rows;

    IF v_has_variant_rows THEN
      -- O produto tem grade de variantes, mas o item do pedido aponta para
      -- uma combinacao que nao existe nela (cor/tamanho renomeado, variante
      -- apagada, ou item gravado sem a selecao). Debitar o agregado aqui
      -- seria inutil: o proximo recalculo o sobrescreve com a soma das
      -- variantes. Registra para conferencia manual em vez de escrever.
      v_unmatched := v_unmatched || jsonb_build_object(
        'product_id', v_product.id,
        'product_title', v_product.title,
        'selected_color', v_item->>'selected_color',
        'selected_size', v_item->>'selected_size',
        'selected_flavor', v_item->>'selected_flavor',
        'requested', v_quantity
      );
      CONTINUE;
    END IF;

    -- Produto simples, sem grade: o agregado e a propria fonte da verdade.
    SELECT stock_quantity INTO v_prev_qty
    FROM products
    WHERE id = v_product.id
    FOR UPDATE;

    v_prev_qty := COALESCE(v_prev_qty, 0);
    v_deduct_qty := LEAST(v_quantity, GREATEST(v_prev_qty, 0));
    v_new_qty := v_prev_qty - v_deduct_qty;

    IF v_deduct_qty < v_quantity THEN
      v_insufficient := v_insufficient || jsonb_build_object(
        'product_id', v_product.id,
        'product_title', v_product.title,
        'variant_stock_id', null,
        'selected_color', null,
        'selected_size', null,
        'selected_flavor', null,
        'requested', v_quantity,
        'deducted', v_deduct_qty,
        'available', v_prev_qty
      );
    END IF;

    IF v_deduct_qty > 0 THEN
      UPDATE products SET stock_quantity = v_new_qty WHERE id = v_product.id;

      INSERT INTO stock_movements (
        product_id, movement_type, quantity, previous_quantity, new_quantity,
        reference_type, reference_id, performed_by
      ) VALUES (
        v_product.id, 'saida', -v_deduct_qty, v_prev_qty, v_new_qty,
        'order', p_order_id::text, p_store_owner_id
      );

      v_deducted_count := v_deducted_count + 1;
    END IF;
  END IF;

  SELECT stock_quantity INTO v_current_stock FROM products WHERE id = v_product.id;
  v_threshold := COALESCE(v_product.low_stock_threshold, 5);

  IF v_current_stock <= 0 THEN
    INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
    VALUES (
      p_store_owner_id, 'out_of_stock', 'Produto esgotado',
      format('O produto "%s" esta esgotado.', v_product.title), v_product.id, 'product'
    );
  ELSIF v_current_stock <= v_threshold THEN
    INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
    VALUES (
      p_store_owner_id, 'low_stock', 'Estoque baixo',
      format('O produto "%s" esta com estoque baixo.', v_product.title), v_product.id, 'product'
    );
  END IF;
END LOOP;

IF jsonb_array_length(v_insufficient) > 0 OR jsonb_array_length(v_unmatched) > 0 THEN
  v_shortfall := jsonb_build_object(
    'insufficient_items', v_insufficient,
    'unmatched_items', v_unmatched,
    'recorded_at', now()
  );
ELSE
  v_shortfall := NULL;
END IF;

UPDATE orders
SET inventory_deducted = (v_deducted_count > 0),
    stock_shortfall = v_shortfall,
    stock_reserved_at = NULL
WHERE id = p_order_id;

RETURN jsonb_build_object(
  'success', true,
  'deducted_count', v_deducted_count,
  'insufficient_items', v_insufficient,
  'unmatched_items', v_unmatched
);
END;
$function$;
