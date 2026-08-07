/*
  # deduct_stock_for_order: recalculo correto, baixa honesta e falhas visiveis

  1. Problemas corrigidos
    a) O recalculo do agregado somava TODAS as variantes, inclusive as orfas,
       desfazendo a baixa que a propria funcao acabara de fazer. Passa a usar
       `recalc_product_aggregate_stock()` (so variantes ofertadas).
    b) Quando o item do pedido nao casava com nenhuma linha de variante, a
       funcao caia no ramo "produto simples" e debitava
       `products.stock_quantity` direto — um valor que o recalculo seguinte
       sobrescreve, fazendo a baixa desaparecer por completo. Agora esse caso
       e detectado e reportado em `unmatched_items`, sem escrita fantasma.
    c) `orders.inventory_deducted` era marcado como true incondicionalmente,
       mesmo quando nada foi baixado (produto sem track_inventory, produto de
       outro dono, combinacao inexistente). O pedido exibia "estoque baixado"
       sem ter baixado nada. Agora so marca quando houve baixa real.
    d) `insufficient_items` era devolvido no jsonb mas nenhum chamador lia.
       Passa a ser persistido em `orders.stock_shortfall`, que o painel usa
       para sinalizar o pedido para conferencia manual.

  2. Compatibilidade
    - Assinatura inalterada. O retorno ganha campos novos
      (`deducted_count`, `unmatched_items`); `success` e `insufficient_items`
      continuam existindo.
*/

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_shortfall jsonb;

COMMENT ON COLUMN public.orders.stock_shortfall IS
  'Itens que nao puderam ser baixados integralmente do estoque no fechamento do pedido (falta de saldo ou variante inexistente). NULL = sem pendencia.';

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
  v_insufficient jsonb := '[]'::jsonb;
  v_unmatched jsonb := '[]'::jsonb;
  v_deducted_count integer := 0;
  v_shortfall jsonb;
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
    stock_shortfall = v_shortfall
WHERE id = p_order_id;

RETURN jsonb_build_object(
  'success', true,
  'deducted_count', v_deducted_count,
  'insufficient_items', v_insufficient,
  'unmatched_items', v_unmatched
);
END;
$function$;
