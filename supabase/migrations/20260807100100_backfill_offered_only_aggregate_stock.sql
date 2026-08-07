/*
  # Backfill: corrigir os agregados ja divergentes

  1. Contexto
    - A migracao 20260807100000 corrige o recalculo dali para frente, mas
      os produtos que ja estao com `products.stock_quantity` divergente
      continuam errados ate a proxima venda — e nessa venda o numero
      "pula" de uma vez (ex.: de 27 para 35), que e justamente o
      comportamento que assustou o lojista.
    - Este backfill antecipa essa correcao de forma controlada e auditavel,
      em vez de deixar acontecer por surpresa na proxima venda.

  2. Escopo
    - Toca APENAS produtos que possuem linhas em product_variant_stock.
      Nesses, a grade de variantes e a fonte da verdade e o agregado e um
      valor derivado.
    - Produtos sem grade de variantes (a grande maioria da base) NAO sao
      tocados: neles o estoque e digitado manualmente no agregado.

  3. Reversibilidade
    - Os valores anteriores ficam gravados em
      `stock_aggregate_backfill_log`. Para desfazer:
        UPDATE products p SET stock_quantity = b.previous_quantity
        FROM stock_aggregate_backfill_log b
        WHERE b.product_id = p.id AND b.batch = '20260807';

  4. Atencao
    - Existe uma segunda fonte de divergencia alem das variantes orfas: a
      edicao rapida de estoque no painel (QuickEditModal / StockEditPopover)
      grava direto no agregado sem tocar nas variantes. Em produto COM
      grade essa edicao manual ja era descartada na venda seguinte; o
      backfill apenas torna isso explicito agora. A correcao dessa entrada
      manual vem na migracao/ajuste de UI que acompanha esta entrega.
*/

CREATE TABLE IF NOT EXISTS public.stock_aggregate_backfill_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_quantity integer,
  new_quantity integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_aggregate_backfill_log_batch
  ON public.stock_aggregate_backfill_log (batch);

ALTER TABLE public.stock_aggregate_backfill_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can view own backfill log" ON public.stock_aggregate_backfill_log;
CREATE POLICY "Store owners can view own backfill log"
  ON public.stock_aggregate_backfill_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = stock_aggregate_backfill_log.product_id
        AND p.user_id = auth.uid()
    )
  );

DO $$
DECLARE
  v_product RECORD;
  v_colors text[];
  v_sizes text[];
  v_flavors text[];
  v_new integer;
  v_changed integer := 0;
  v_seen integer := 0;
BEGIN
  FOR v_product IN
    SELECT p.id, p.stock_quantity, p.colors, p.sizes, p.flavors
    FROM products p
    WHERE EXISTS (SELECT 1 FROM product_variant_stock v WHERE v.product_id = p.id)
  LOOP
    v_seen := v_seen + 1;

    v_colors  := ARRAY(SELECT btrim(x) FROM unnest(COALESCE(v_product.colors,  '{}'::text[])) AS x WHERE btrim(x) <> '');
    v_sizes   := ARRAY(SELECT btrim(x) FROM unnest(COALESCE(v_product.sizes,   '{}'::text[])) AS x WHERE btrim(x) <> '');
    v_flavors := ARRAY(SELECT btrim(x) FROM unnest(COALESCE(v_product.flavors, '{}'::text[])) AS x WHERE btrim(x) <> '');

    SELECT COALESCE(SUM(quantity), 0)
    INTO v_new
    FROM product_variant_stock
    WHERE product_id = v_product.id
      AND variant_row_is_offered(color, size, flavor, v_colors, v_sizes, v_flavors);

    IF v_new IS DISTINCT FROM v_product.stock_quantity THEN
      INSERT INTO stock_aggregate_backfill_log (batch, product_id, previous_quantity, new_quantity)
      VALUES ('20260807', v_product.id, v_product.stock_quantity, v_new);

      UPDATE products SET stock_quantity = v_new WHERE id = v_product.id;
      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill de estoque agregado: % produtos com grade avaliados, % corrigidos', v_seen, v_changed;
END $$;
