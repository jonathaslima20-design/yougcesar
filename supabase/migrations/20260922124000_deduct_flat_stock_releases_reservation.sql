/*
  # deduct_stock_for_order: release the flat-stock reservation too

  Companion to 20260922123000 (reserve_stock_for_order/
  release_order_stock_reservation gained a flat-stock branch). The variant
  branch here already converts a held reservation into the real deduction
  (`reserved_quantity = ... WHEN v_had_reservation ...`); the flat-stock
  branch only ever touched `stock_quantity`, so a flat product's
  `products.reserved_quantity` — now written by reserve_stock_for_order —
  would never be released back down after approval, leaking that quantity
  out of availability forever. Same `v_had_reservation` pattern, applied to
  the flat branch.
*/

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
  v_prev_reserved integer;
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
    SELECT stock_quantity, reserved_quantity INTO v_prev_qty, v_prev_reserved
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
      -- Same conversion as the variant branch above: a held reservation on
      -- this flat product becomes the real deduction instead of staying
      -- double-counted against availability forever.
      UPDATE products
      SET stock_quantity = v_new_qty,
          reserved_quantity = CASE WHEN v_had_reservation THEN GREATEST(0, reserved_quantity - v_quantity) ELSE reserved_quantity END
      WHERE id = v_product.id;

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
