/*
  # restore_stock_for_order: estornar exatamente o que foi baixado

  1. Problema
    - O estorno rodava client-side (`restoreStockForOrder` em stockUtils.ts) e
      devolvia ao estoque a quantidade do ITEM DO PEDIDO, nao a quantidade que
      de fato saiu.
    - Desde que a baixa passou a ser limitada ao saldo disponivel (para nao
      deixar o estoque negativo), as duas coisas divergem: um pedido de 5
      unidades com apenas 3 em estoque baixa 3. Cancelar esse pedido devolvia
      5 — criando 2 unidades que nunca existiram.
    - O estorno tambem somava direto no agregado quando nao achava a variante,
      escrita que o recalculo seguinte descarta, e nao tinha trava de linha
      (dois cancelamentos simultaneos do mesmo pedido duplicavam a devolucao).

  2. Fix
    - Nova RPC que le `stock_movements` (reference_type='order',
      movement_type='saida') como fonte da verdade do que realmente saiu, e
      devolve exatamente isso, com `FOR UPDATE` na linha de estoque.
    - Idempotente: se ja existe movimento de 'cancelamento' para o pedido, nao
      estorna de novo.
    - Reaproveita `recalc_product_aggregate_stock()` para o agregado.
*/

CREATE OR REPLACE FUNCTION public.restore_stock_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_owner uuid;
  v_movement RECORD;
  v_restore_qty integer;
  v_prev_qty integer;
  v_new_qty integer;
  v_restored_count integer := 0;
  v_already boolean;
BEGIN
  SELECT store_owner_id INTO v_owner FROM orders WHERE id = p_order_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido nao encontrado');
  END IF;

  -- auth.uid() e NULL quando a chamada vem do service_role (webhook de
  -- pagamento estornando um chargeback). Nesse caso nao ha dono a conferir;
  -- para qualquer sessao autenticada, o pedido tem que ser dela.
  IF auth.uid() IS NOT NULL AND v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Pedido nao pertence ao usuario atual';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM stock_movements
    WHERE reference_type = 'order'
      AND reference_id = p_order_id::text
      AND movement_type = 'cancelamento'
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('success', true, 'restored_count', 0, 'already_restored', true);
  END IF;

  FOR v_movement IN
    SELECT id, product_id, variant_stock_id, quantity
    FROM stock_movements
    WHERE reference_type = 'order'
      AND reference_id = p_order_id::text
      AND movement_type = 'saida'
  LOOP
    -- 'saida' grava a quantidade como negativa; o que volta e o modulo dela.
    v_restore_qty := ABS(v_movement.quantity);
    IF v_restore_qty = 0 THEN
      CONTINUE;
    END IF;

    IF v_movement.variant_stock_id IS NOT NULL THEN
      SELECT quantity INTO v_prev_qty
      FROM product_variant_stock
      WHERE id = v_movement.variant_stock_id
      FOR UPDATE;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      v_new_qty := v_prev_qty + v_restore_qty;

      UPDATE product_variant_stock
      SET quantity = v_new_qty, updated_at = now()
      WHERE id = v_movement.variant_stock_id;

      INSERT INTO stock_movements (
        product_id, variant_stock_id, movement_type, quantity,
        previous_quantity, new_quantity, reference_type, reference_id, performed_by
      ) VALUES (
        v_movement.product_id, v_movement.variant_stock_id, 'cancelamento', v_restore_qty,
        v_prev_qty, v_new_qty, 'order', p_order_id::text, v_owner
      );

      PERFORM recalc_product_aggregate_stock(v_movement.product_id);
    ELSE
      SELECT stock_quantity INTO v_prev_qty
      FROM products
      WHERE id = v_movement.product_id
      FOR UPDATE;

      v_prev_qty := COALESCE(v_prev_qty, 0);
      v_new_qty := v_prev_qty + v_restore_qty;

      UPDATE products SET stock_quantity = v_new_qty WHERE id = v_movement.product_id;

      INSERT INTO stock_movements (
        product_id, movement_type, quantity,
        previous_quantity, new_quantity, reference_type, reference_id, performed_by
      ) VALUES (
        v_movement.product_id, 'cancelamento', v_restore_qty,
        v_prev_qty, v_new_qty, 'order', p_order_id::text, v_owner
      );
    END IF;

    v_restored_count := v_restored_count + 1;
  END LOOP;

  UPDATE orders SET inventory_deducted = false WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'restored_count', v_restored_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.restore_stock_for_order(uuid) TO authenticated;
