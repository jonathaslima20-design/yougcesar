/*
  # Fix stock never being deducted for storefront checkouts

  1. Problem
    - Auto-deduct-on-checkout ran entirely client-side (`deductStockForOrder`
      in stockUtils.ts), issuing direct UPDATE/INSERT calls to
      `product_variant_stock`, `products` and `stock_movements` from the
      BUYER's browser session.
    - Those tables' RLS policies only allow the product OWNER
      (`products.user_id = auth.uid()`) to write. A buyer's session never
      satisfies that, so:
        - the `product_variant_stock` / `products` UPDATEs were silently
          filtered out by RLS (no error — UPDATE just matches 0 rows), and
        - the `stock_movements` INSERT failed RLS but the error was caught
          and only logged to the console.
    - The function still finished by setting `orders.inventory_deducted =
      true`, so the order looked like stock had been handled when nothing
      actually changed. This affected every storefront checkout with
      auto-deduct enabled, not just one order.

  2. Fix
    - New `deduct_stock_for_order` function, SECURITY DEFINER, doing the
      same per-item work (variant or product-level stock update, movement
      record, low/out-of-stock notification) with elevated privilege so it
      works regardless of who triggered the checkout.
    - `stockUtils.ts` now calls this RPC instead of writing to the tables
      directly. The manual "confirm order" path (run by the seller's own
      session in the dashboard) uses the same function, so behavior there
      is unchanged other than being centralized.
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
v_current_stock integer;
v_threshold integer;
BEGIN
FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
LOOP
  SELECT id, title, track_inventory, stock_quantity, low_stock_threshold
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
  LIMIT 1;

  IF FOUND THEN
    v_prev_qty := v_variant.quantity;
    v_new_qty := v_prev_qty - v_quantity;

    UPDATE product_variant_stock
    SET quantity = v_new_qty, updated_at = now()
    WHERE id = v_variant.id;

    INSERT INTO stock_movements (
      product_id, variant_stock_id, movement_type, quantity,
      previous_quantity, new_quantity, reference_type, reference_id, performed_by
    ) VALUES (
      v_product.id, v_variant.id, 'saida', -v_quantity,
      v_prev_qty, v_new_qty, 'order', p_order_id::text, p_store_owner_id
    );

    UPDATE products
    SET stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0) FROM product_variant_stock WHERE product_id = v_product.id
    )
    WHERE id = v_product.id;
  ELSE
    v_prev_qty := COALESCE(v_product.stock_quantity, 0);
    v_new_qty := v_prev_qty - v_quantity;

    UPDATE products SET stock_quantity = v_new_qty WHERE id = v_product.id;

    INSERT INTO stock_movements (
      product_id, movement_type, quantity, previous_quantity, new_quantity,
      reference_type, reference_id, performed_by
    ) VALUES (
      v_product.id, 'saida', -v_quantity, v_prev_qty, v_new_qty,
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

RETURN jsonb_build_object('success', true);
END;
$function$;
