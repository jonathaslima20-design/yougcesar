/*
  # Faixas de preço: validar só o produto alterado

  1. Problem
    - validate_price_tiers_trigger roda FOR EACH STATEMENT e a função percorre
      SELECT DISTINCT product_id FROM product_price_tiers (a tabela inteira) a cada
      comando. Cada salvamento de faixas revalidava todos os produtos da loja plataforma
      (média de ~7 s por operação, na soma de 28 milhões de ms).

  2. Changes
    - A função valida apenas o product_id da linha alterada (NEW ou OLD).
    - O gatilho passa a ser FOR EACH ROW AFTER: roda depois do comando completo, então
      vê todas as faixas inseridas de uma vez. As regras de validação não mudam.

  3. Notes
    - Produtos que não foram alterados já foram validados quando foram gravados.
    - Nenhuma alteração de dados. Pode ser aplicada com segurança e rodada de novo.
*/

CREATE OR REPLACE FUNCTION public.validate_all_price_tiers_for_product()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_product_id uuid;
  tier_count integer;
  null_max_count integer;
  max_min_quantity integer;
  unlimited_tier_min_quantity integer;
  has_overlaps boolean;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  SELECT COUNT(*) INTO tier_count
  FROM product_price_tiers
  WHERE product_id = v_product_id;

  IF tier_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO null_max_count
  FROM product_price_tiers
  WHERE product_id = v_product_id AND max_quantity IS NULL;

  IF null_max_count > 1 THEN
    RAISE EXCEPTION 'Only one tier can have unlimited (NULL) max_quantity for product %', v_product_id;
  END IF;

  IF null_max_count = 1 THEN
    SELECT MAX(min_quantity) INTO max_min_quantity
    FROM product_price_tiers
    WHERE product_id = v_product_id;

    SELECT min_quantity INTO unlimited_tier_min_quantity
    FROM product_price_tiers
    WHERE product_id = v_product_id AND max_quantity IS NULL;

    IF unlimited_tier_min_quantity != max_min_quantity THEN
      RAISE EXCEPTION 'Only the last tier (highest min_quantity) can have unlimited (NULL) max_quantity for product %', v_product_id;
    END IF;
  END IF;

  -- Overlaps: exact quantity tiers (min = max) may coexist as long as they don't share a quantity.
  SELECT EXISTS (
    SELECT 1
    FROM product_price_tiers t1
    JOIN product_price_tiers t2 ON t1.product_id = t2.product_id AND t1.id != t2.id
    WHERE t1.product_id = v_product_id
      AND (
        t1.min_quantity <= COALESCE(t2.max_quantity, 999999) AND
        COALESCE(t1.max_quantity, 999999) >= t2.min_quantity
      )
  ) INTO has_overlaps;

  IF has_overlaps THEN
    RAISE EXCEPTION 'Price tiers cannot have overlapping quantity ranges for product %', v_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM product_price_tiers
    WHERE product_id = v_product_id
      AND max_quantity IS NOT NULL
      AND min_quantity > max_quantity
  ) THEN
    RAISE EXCEPTION 'Each tier must have min_quantity <= max_quantity for product %', v_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM product_price_tiers
    WHERE product_id = v_product_id
      AND (unit_price <= 0 OR (discounted_unit_price IS NOT NULL AND discounted_unit_price <= 0))
  ) THEN
    RAISE EXCEPTION 'All prices must be greater than zero for product %', v_product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM product_price_tiers
    WHERE product_id = v_product_id
      AND discounted_unit_price IS NOT NULL
      AND discounted_unit_price >= unit_price
  ) THEN
    RAISE EXCEPTION 'Discounted price must be less than unit price for product %', v_product_id;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS validate_price_tiers_trigger ON public.product_price_tiers;
CREATE TRIGGER validate_price_tiers_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.product_price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_all_price_tiers_for_product();
