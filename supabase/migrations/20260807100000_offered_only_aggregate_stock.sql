/*
  # Estoque agregado passa a somar apenas variantes realmente ofertadas

  1. Problema
    - `products.stock_quantity` e um valor DERIVADO: sempre que uma venda
      baixa uma variante, ele e recalculado como
      `SUM(quantity) FROM product_variant_stock WHERE product_id = ...`.
    - Esse SUM inclui linhas ORFAS: variantes de uma cor/tamanho que o
      lojista removeu de `products.colors` / `products.sizes`. A grade de
      edicao (VariantStockGrid) so monta celulas para as combinacoes
      atuais, entao a linha orfa fica invisivel na tela, nunca e apagada,
      mas continua sendo somada no recalculo.
    - Resultado observado em producao (loja SAMMY T-SHIRTS): o lojista
      vende 1 unidade, a variante e debitada corretamente, e em seguida o
      agregado e recomposto somando as orfas — voltando ao mesmo numero
      (ou a um numero MAIOR) do que antes da venda. Da loja dele:
        "T-SHIRT PLUS CITRUS"  -> tamanhos ofertados ["G3"], mas existe
        uma orfa VERDE BEBE/G2=1. Agregado 7 antes da venda, 7 depois.
        "T-SHIRT PLUS MY LIFE'S" -> ofertado so G3 (soma 27), orfas em
        G1/G2/G4 somam 8. A proxima venda faria o estoque SUBIR de 27
        para 35.
    - Para o lojista isso aparece exatamente como "a baixa no estoque nao
      esta sendo realizada".

  2. Decisao
    - As linhas orfas NAO sao apagadas. Elas continuam no banco intactas,
      apenas fora do total. Se o lojista voltar a oferecer o tamanho G3,
      o estoque daquelas pecas reaparece sozinho. Reversivel e sem perda
      de dado — pecas removidas da vitrine podem existir fisicamente no
      estoque dele.

  3. Fix
    - `variant_row_is_offered()` decide se uma linha de variante pertence
      a oferta atual do produto. Uma dimensao vazia no produto (sem cores,
      por exemplo) exige que a coluna correspondente da variante seja NULL —
      e por isso que a linha duplicada `color=NULL` de "T-SHIRT PLUS NEW
      YORK" (que convive com LILAS/G2 criando dois pools para a mesma peca)
      passa a ficar de fora.
    - `recalc_product_aggregate_stock()` centraliza o recalculo. Produtos
      SEM nenhuma linha de variante nao sao tocados: nesses, o estoque e
      gerido manualmente direto em products.stock_quantity.
    - `recalc_my_product_aggregate_stock()` e o wrapper exposto ao cliente,
      com checagem de dono — a funcao interna e SECURITY DEFINER porque
      tambem roda dentro do checkout do comprador.

  4. Backfill
    - Fica em migracao separada (20260807100100), para poder ser revisada
      e aplicada em separado: ela altera numeros de estoque visiveis.
*/

-- Uma linha de variante pertence a oferta atual do produto quando cada uma
-- das tres dimensoes bate: se o produto nao oferece aquela dimensao, a
-- coluna da variante precisa ser NULL; se oferece, o valor precisa estar
-- na lista. Comparacao com btrim dos dois lados para tolerar espacos
-- acidentais nas listas digitadas pelo lojista.
CREATE OR REPLACE FUNCTION public.variant_row_is_offered(
  p_color text,
  p_size text,
  p_flavor text,
  p_colors text[],
  p_sizes text[],
  p_flavors text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT
    (CASE
       WHEN COALESCE(array_length(p_colors, 1), 0) = 0 THEN p_color IS NULL
       ELSE p_color IS NOT NULL AND btrim(p_color) = ANY (p_colors)
     END)
    AND
    (CASE
       WHEN COALESCE(array_length(p_sizes, 1), 0) = 0 THEN p_size IS NULL
       ELSE p_size IS NOT NULL AND btrim(p_size) = ANY (p_sizes)
     END)
    AND
    (CASE
       WHEN COALESCE(array_length(p_flavors, 1), 0) = 0 THEN p_flavor IS NULL
       ELSE p_flavor IS NOT NULL AND btrim(p_flavor) = ANY (p_flavors)
     END)
$function$;

-- Recalcula e grava products.stock_quantity a partir das variantes
-- ofertadas. Retorna o novo total, ou NULL quando o produto nao tem grade
-- de variantes (nesse caso o estoque e manual e nao deve ser sobrescrito).
CREATE OR REPLACE FUNCTION public.recalc_product_aggregate_stock(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_colors text[];
  v_sizes text[];
  v_flavors text[];
  v_has_rows boolean;
  v_total integer;
BEGIN
  SELECT
    ARRAY(SELECT btrim(x) FROM unnest(COALESCE(colors,  '{}'::text[])) AS x WHERE btrim(x) <> ''),
    ARRAY(SELECT btrim(x) FROM unnest(COALESCE(sizes,   '{}'::text[])) AS x WHERE btrim(x) <> ''),
    ARRAY(SELECT btrim(x) FROM unnest(COALESCE(flavors, '{}'::text[])) AS x WHERE btrim(x) <> '')
  INTO v_colors, v_sizes, v_flavors
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (SELECT 1 FROM product_variant_stock WHERE product_id = p_product_id)
  INTO v_has_rows;

  IF NOT v_has_rows THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total
  FROM product_variant_stock
  WHERE product_id = p_product_id
    AND variant_row_is_offered(color, size, flavor, v_colors, v_sizes, v_flavors);

  UPDATE products SET stock_quantity = v_total WHERE id = p_product_id;

  RETURN v_total;
END;
$function$;

-- Wrapper para o painel do lojista (substitui o syncProductAggregateStock
-- que era feito client-side somando TODAS as variantes).
CREATE OR REPLACE FUNCTION public.recalc_my_product_aggregate_stock(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM products WHERE id = p_product_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Produto nao encontrado ou nao pertence ao usuario atual';
  END IF;

  RETURN recalc_product_aggregate_stock(p_product_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.recalc_product_aggregate_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_my_product_aggregate_stock(uuid) TO authenticated;

-- Lista as variantes orfas de um produto (fora da oferta atual, mas com
-- saldo). Alimenta o aviso no painel para o lojista decidir se reativa a
-- cor/tamanho ou zera aquelas pecas.
CREATE OR REPLACE FUNCTION public.list_orphan_variant_stock(p_product_id uuid)
RETURNS TABLE (
  variant_stock_id uuid,
  color text,
  size text,
  flavor text,
  quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_owner uuid;
  v_colors text[];
  v_sizes text[];
  v_flavors text[];
BEGIN
  SELECT
    user_id,
    ARRAY(SELECT btrim(x) FROM unnest(COALESCE(colors,  '{}'::text[])) AS x WHERE btrim(x) <> ''),
    ARRAY(SELECT btrim(x) FROM unnest(COALESCE(sizes,   '{}'::text[])) AS x WHERE btrim(x) <> ''),
    ARRAY(SELECT btrim(x) FROM unnest(COALESCE(flavors, '{}'::text[])) AS x WHERE btrim(x) <> '')
  INTO v_owner, v_colors, v_sizes, v_flavors
  FROM products
  WHERE id = p_product_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Produto nao encontrado ou nao pertence ao usuario atual';
  END IF;

  RETURN QUERY
  SELECT pvs.id, pvs.color, pvs.size, pvs.flavor, pvs.quantity
  FROM product_variant_stock pvs
  WHERE pvs.product_id = p_product_id
    AND NOT variant_row_is_offered(pvs.color, pvs.size, pvs.flavor, v_colors, v_sizes, v_flavors)
    AND pvs.quantity <> 0
  ORDER BY pvs.color NULLS FIRST, pvs.size NULLS FIRST, pvs.flavor NULLS FIRST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_orphan_variant_stock(uuid) TO authenticated;
