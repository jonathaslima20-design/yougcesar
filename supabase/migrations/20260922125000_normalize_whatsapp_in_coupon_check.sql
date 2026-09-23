/*
  # Defense-in-depth: normalize customer_whatsapp when checking coupon usage

  The frontend fix (cleanWhatsappDigits, used consistently by both the
  coupon-preview call and order creation now) is the real fix for the
  format mismatch between preview and creation. This is a second layer in
  the database itself, in case some other caller ever sends the phone in a
  different format again — the max_uses_per_customer check compares
  digits-only instead of the raw stored value.
*/

CREATE OR REPLACE FUNCTION public.compute_coupon_discount(
  p_coupon_id uuid,
  p_customer_whatsapp text DEFAULT ''::text,
  p_cart_total numeric DEFAULT 0,
  p_product_ids uuid[] DEFAULT '{}'::uuid[],
  p_cart_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_coupon RECORD;
v_calculated_discount numeric;
v_customer_uses integer;
v_eligible_total numeric;
v_eligible_product_ids uuid[];
BEGIN
SELECT * INTO v_coupon FROM coupons WHERE id = p_coupon_id;

IF v_coupon IS NULL THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Cupom não encontrado', 'calculated_discount', 0);
END IF;

IF NOT v_coupon.is_active THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Este cupom está desativado', 'calculated_discount', 0);
END IF;

IF v_coupon.valid_from > now() THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Este cupom ainda não está válido', 'calculated_discount', 0);
END IF;

IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Este cupom expirou', 'calculated_discount', 0);
END IF;

IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Este cupom atingiu o limite de uso', 'calculated_discount', 0);
END IF;

IF v_coupon.max_uses_per_customer IS NOT NULL AND regexp_replace(p_customer_whatsapp, '\D', '', 'g') != '' THEN
SELECT COUNT(*) INTO v_customer_uses
FROM coupon_usages
WHERE coupon_id = v_coupon.id
AND regexp_replace(customer_whatsapp, '\D', '', 'g') = regexp_replace(p_customer_whatsapp, '\D', '', 'g');

IF v_customer_uses >= v_coupon.max_uses_per_customer THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Você já usou este cupom o número máximo de vezes', 'calculated_discount', 0);
END IF;
END IF;

IF p_cart_total < v_coupon.min_order_value THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', format('Pedido mínimo de R$ %s para usar este cupom', to_char(v_coupon.min_order_value, 'FM999G999D00')),
'calculated_discount', 0
);
END IF;

IF v_coupon.applies_to = 'specific_products' THEN
SELECT ARRAY_AGG(cp.product_id) INTO v_eligible_product_ids
FROM coupon_products cp
WHERE cp.coupon_id = v_coupon.id
AND cp.product_id = ANY(p_product_ids);

IF v_eligible_product_ids IS NULL OR array_length(v_eligible_product_ids, 1) IS NULL THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Nenhum produto elegível para este cupom no carrinho', 'calculated_discount', 0);
END IF;
ELSIF v_coupon.applies_to = 'specific_categories' THEN
-- coupon_categories.category_id stores a category NAME (text), matching
-- products.category (text[]) — products have no category_id FK.
SELECT ARRAY_AGG(DISTINCT p.id) INTO v_eligible_product_ids
FROM products p
INNER JOIN coupon_categories cc ON cc.category_id = ANY(p.category)
WHERE cc.coupon_id = v_coupon.id
AND p.id = ANY(p_product_ids);

IF v_eligible_product_ids IS NULL OR array_length(v_eligible_product_ids, 1) IS NULL THEN
RETURN jsonb_build_object('valid', false, 'error_message', 'Nenhum produto elegível para este cupom no carrinho', 'calculated_discount', 0);
END IF;
END IF;

-- coupons scoped to specific products/categories only discount the
-- subtotal of the eligible cart lines, never the whole cart.
IF v_eligible_product_ids IS NOT NULL AND COALESCE(jsonb_array_length(p_cart_items), 0) > 0 THEN
SELECT COALESCE(SUM((item->>'subtotal')::numeric), 0) INTO v_eligible_total
FROM jsonb_array_elements(p_cart_items) AS item
WHERE (item->>'product_id')::uuid = ANY(v_eligible_product_ids);
ELSE
v_eligible_total := p_cart_total;
END IF;

IF v_coupon.discount_type = 'percentage' THEN
v_calculated_discount := v_eligible_total * (v_coupon.discount_value / 100);
IF v_coupon.max_discount_amount IS NOT NULL AND v_calculated_discount > v_coupon.max_discount_amount THEN
v_calculated_discount := v_coupon.max_discount_amount;
END IF;
ELSE
v_calculated_discount := LEAST(v_coupon.discount_value, v_eligible_total);
END IF;

v_calculated_discount := ROUND(v_calculated_discount, 2);

RETURN jsonb_build_object(
'valid', true,
'coupon_id', v_coupon.id,
'code', v_coupon.code,
'name', v_coupon.name,
'discount_type', v_coupon.discount_type,
'discount_value', v_coupon.discount_value,
'calculated_discount', v_calculated_discount,
'error_message', null
);
END;
$function$;
