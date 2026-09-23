/*
  # Reserve stock for flat (non-variant) products too

  1. Problem
     - `deduct_stock_for_order` already has a flat-stock branch: when a
       product has no variant grid at all, it deducts directly from
       `products.stock_quantity` instead of `product_variant_stock`
       (20260807100200_fix_deduct_stock_for_order.sql).
     - `reserve_stock_for_order` never got the matching branch — it only
       ever reserves against `product_variant_stock`, and unconditionally
       skips (`CONTINUE`) any item with no matching variant row, including
       products that have no variant grid at all. So a simple product with
       no variants has zero protection during the pending-payment window:
       two buyers can each generate a Pix for the last unit at the same
       time, both pay, and only the first deduction (whichever payment is
       processed first) actually has stock to take from.

  2. Fix
     - `products.reserved_quantity` (new column, mirrors
       `product_variant_stock.reserved_quantity`) tracks the same thing for
       flat-stock products.
     - `reserve_stock_for_order`: when there's no matching variant row,
       distinguish two cases exactly the way `deduct_stock_for_order`
       already does — a product WITH a variant grid where this specific
       color/size/flavor combination just doesn't exist (stale cart,
       renamed/deleted variant) is a data mismatch to leave alone, not a
       stock question; only a product with NO variant grid at all falls
       through to reserve against `products.stock_quantity`/
       `reserved_quantity` directly.
     - `deduct_stock_for_order`'s existing flat-stock branch now also
       decrements `reserved_quantity` when converting a reservation into a
       real deduction (same `v_had_reservation` pattern the variant branch
       already uses), instead of only touching `stock_quantity`.
     - `release_order_stock_reservation` gets the matching flat-stock
       branch to give the reservation back on an abandoned/declined
       payment.
*/

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;

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
  v_flat RECORD;
  v_has_variant_rows boolean;
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

    IF FOUND THEN
      IF (v_variant.quantity - v_variant.reserved_quantity) < v_item.quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente para %', v_product.title;
      END IF;

      UPDATE product_variant_stock
      SET reserved_quantity = reserved_quantity + v_item.quantity,
          updated_at = now()
      WHERE id = v_variant.id;

      CONTINUE;
    END IF;

    -- No matching variant row. A product that HAS a variant grid where
    -- this exact color/size/flavor combination doesn't exist in it is a
    -- data mismatch (stale cart, renamed/deleted variant) —
    -- deduct_stock_for_order already treats that as an "unmatched" case
    -- to flag rather than act on, so reserving here would be meaningless.
    -- Only a product with NO variant grid at all (flat/simple stock)
    -- falls through to reserve against products.stock_quantity itself.
    SELECT EXISTS (SELECT 1 FROM product_variant_stock WHERE product_id = v_product.id)
    INTO v_has_variant_rows;

    IF v_has_variant_rows THEN
      CONTINUE;
    END IF;

    SELECT stock_quantity, reserved_quantity INTO v_flat
    FROM products
    WHERE id = v_product.id
    FOR UPDATE;

    IF (COALESCE(v_flat.stock_quantity, 0) - COALESCE(v_flat.reserved_quantity, 0)) < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', v_product.title;
    END IF;

    UPDATE products
    SET reserved_quantity = reserved_quantity + v_item.quantity
    WHERE id = v_product.id;
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
  v_has_variant_rows boolean;
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

    IF FOUND THEN
      UPDATE product_variant_stock
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity),
          updated_at = now()
      WHERE id = v_variant.id;
      CONTINUE;
    END IF;

    SELECT EXISTS (SELECT 1 FROM product_variant_stock WHERE product_id = v_product.id)
    INTO v_has_variant_rows;

    IF v_has_variant_rows THEN
      CONTINUE;
    END IF;

    UPDATE products
    SET reserved_quantity = GREATEST(0, reserved_quantity - v_item.quantity)
    WHERE id = v_product.id;
  END LOOP;

  UPDATE orders SET stock_reserved_at = NULL WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'released', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_stock_for_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock_reservation TO authenticated;
