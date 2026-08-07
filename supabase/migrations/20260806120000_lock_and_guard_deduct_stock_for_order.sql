/*
  # Fix overselling: deduct_stock_for_order can drive stock negative

  1. Problem
    - `deduct_stock_for_order` read the current quantity, computed
      `quantity - requested`, and wrote it back with a plain UPDATE — no
      row lock and no floor check. When two checkouts for the same
      variant (or same non-variant product) landed close together, both
      read the same starting quantity and both subtracted, so the stock
      could go negative (observed: -1 on a real order).
    - This is a genuine race, not just a display bug: the storefront cart
      never re-validates stock at checkout time, and `create_order_complete`
      creates the order regardless of availability, so nothing upstream
      prevents two buyers from "winning" the same last unit.

  2. Fix
    - `SELECT ... FOR UPDATE` the variant row (or the product row, for
      products without per-variant stock) before deducting, so a second
      concurrent call for the same row blocks until the first finishes
      and sees the updated quantity.
    - Clamp the deduction so quantity never drops below 0
      (`v_deduct_qty := LEAST(v_quantity, GREATEST(v_prev_qty, 0))`).
    - Report any item that couldn't be fully deducted in the returned
      jsonb (`insufficient_items`) so the caller/dashboard can flag the
      order for manual attention instead of silently under-fulfilling it.
*/

CREATE OR REPLACE FUNCTION public.deduct_stock_for_order(
  p_order_id uuid,
  p_store_owner_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
v_insufficient jsonb := '[]'::jsonb;
BEGIN
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
        'variant_stock_id', v_variant.id,
        'requested', v_quantity,
        'available', GREATEST(v_prev_qty, 0)
      );
    END IF;

    UPDATE product_variant_stock
    SET quantity = v_new_qty, updated_at = now()
    WHERE id = v_variant.id;

    INSERT INTO stock_movements (
      product_id, variant_stock_id, movement_type, quantity,
      previous_quantity, new_quantity, reference_type, reference_id, performed_by
    ) VALUES (
      v_product.id, v_variant.id, 'saida', -v_deduct_qty,
      v_prev_qty, v_new_qty, 'order', p_order_id::text, p_store_owner_id
    );

    UPDATE products
    SET stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0) FROM product_variant_stock WHERE product_id = v_product.id
    )
    WHERE id = v_product.id;
  ELSE
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
        'variant_stock_id', null,
        'requested', v_quantity,
        'available', v_prev_qty
      );
    END IF;

    UPDATE products SET stock_quantity = v_new_qty WHERE id = v_product.id;

    INSERT INTO stock_movements (
      product_id, movement_type, quantity, previous_quantity, new_quantity,
      reference_type, reference_id, performed_by
    ) VALUES (
      v_product.id, 'saida', -v_deduct_qty, v_prev_qty, v_new_qty,
      'order', p_order_id::text, p_store_owner_id
    );
  END IF;

  SELECT stock_quantity INTO v_current_stock FROM products WHERE id = v_product.id;
  v_threshold := COALESCE(v_product.low_stock_threshold, 5);

  IF v_current_stock <= 0 THEN
    INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
    VALUES (
      p_store_owner_id, 'out_of_stock', 'Produto esgotado',
      format('O produto "%s" está esgotado.', v_product.title), v_product.id, 'product'
    );
  ELSIF v_current_stock <= v_threshold THEN
    INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
    VALUES (
      p_store_owner_id, 'low_stock', 'Estoque baixo',
      format('O produto "%s" está com estoque baixo.', v_product.title), v_product.id, 'product'
    );
  END IF;
END LOOP;

UPDATE orders SET inventory_deducted = true WHERE id = p_order_id;

RETURN jsonb_build_object('success', true, 'insufficient_items', v_insufficient);
END;
$function$;
