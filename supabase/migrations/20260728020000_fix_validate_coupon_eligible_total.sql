/*
  # Fix validate_coupon applying the discount to the whole cart

  1. Problem
    - For coupons scoped to `specific_products` or `specific_categories`,
      `validate_coupon` correctly checked that at least one eligible
      product was in the cart, but then computed the discount from
      `p_cart_total` (the *entire* cart) instead of only the subtotal of
      the eligible line(s). A 100%-off coupon for product A, with A and B
      in the cart, ended up discounting A+B.
    - Root cause: `v_eligible_total := p_cart_total;` ignored
      `v_eligible_product_ids` entirely.

  2. Fix
    - Add an optional `p_cart_items` jsonb parameter: an array of
      `{"product_id": "...", "subtotal": ...}`, one per cart line, sent by
      the client alongside the existing `p_product_ids` list.
    - For `specific_products` / `specific_categories` coupons, the
      eligible total is now the sum of only the cart lines whose product
      is in `v_eligible_product_ids`.
    - `all_products` coupons are unaffected (still the full cart total).
    - If `p_cart_items` is omitted/empty (e.g. an older client), falls
      back to the previous whole-cart behavior rather than zeroing the
      discount out.
    - Appending a new parameter with a default keeps this a safe
      `CREATE OR REPLACE`: existing callers that don't pass `p_cart_items`
      keep working unchanged.
*/

CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_store_owner_id uuid,
  p_code text,
  p_customer_whatsapp text DEFAULT ''::text,
  p_cart_total numeric DEFAULT 0,
  p_product_ids uuid[] DEFAULT '{}'::uuid[],
  p_cart_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
v_coupon RECORD;
v_calculated_discount numeric;
v_customer_uses integer;
v_eligible_total numeric;
v_eligible_product_ids uuid[];
BEGIN
-- Find the coupon
SELECT * INTO v_coupon
FROM coupons
WHERE user_id = p_store_owner_id
AND UPPER(code) = UPPER(p_code)
LIMIT 1;

-- Check if coupon exists
IF v_coupon IS NULL THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Cupom não encontrado'
);
END IF;

-- Check if active
IF NOT v_coupon.is_active THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Este cupom está desativado'
);
END IF;

-- Check validity period
IF v_coupon.valid_from > now() THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Este cupom ainda não está válido'
);
END IF;

IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Este cupom expirou'
);
END IF;

-- Check max uses
IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Este cupom atingiu o limite de uso'
);
END IF;

-- Check max uses per customer
IF v_coupon.max_uses_per_customer IS NOT NULL AND p_customer_whatsapp != '' THEN
SELECT COUNT(*) INTO v_customer_uses
FROM coupon_usages
WHERE coupon_id = v_coupon.id
AND customer_whatsapp = p_customer_whatsapp;

IF v_customer_uses >= v_coupon.max_uses_per_customer THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Você já usou este cupom o número máximo de vezes'
);
END IF;
END IF;

-- Check minimum order value
IF p_cart_total < v_coupon.min_order_value THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', format('Pedido mínimo de R$ %s para usar este cupom', to_char(v_coupon.min_order_value, 'FM999G999D00'))
);
END IF;

-- Check product eligibility and calculate eligible total
IF v_coupon.applies_to = 'specific_products' THEN
SELECT ARRAY_AGG(cp.product_id) INTO v_eligible_product_ids
FROM coupon_products cp
WHERE cp.coupon_id = v_coupon.id
AND cp.product_id = ANY(p_product_ids);

IF v_eligible_product_ids IS NULL OR array_length(v_eligible_product_ids, 1) IS NULL THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Nenhum produto elegível para este cupom no carrinho'
);
END IF;
ELSIF v_coupon.applies_to = 'specific_categories' THEN
SELECT ARRAY_AGG(DISTINCT p.id) INTO v_eligible_product_ids
FROM products p
INNER JOIN coupon_categories cc ON cc.category_id = p.category_id
WHERE cc.coupon_id = v_coupon.id
AND p.id = ANY(p_product_ids);

IF v_eligible_product_ids IS NULL OR array_length(v_eligible_product_ids, 1) IS NULL THEN
RETURN jsonb_build_object(
'valid', false,
'error_message', 'Nenhum produto elegível para este cupom no carrinho'
);
END IF;
END IF;

-- Calculate discount: coupons scoped to specific products/categories only
-- discount the subtotal of the eligible cart lines, never the whole cart.
IF v_eligible_product_ids IS NOT NULL AND COALESCE(jsonb_array_length(p_cart_items), 0) > 0 THEN
SELECT COALESCE(SUM((item->>'subtotal')::numeric), 0) INTO v_eligible_total
FROM jsonb_array_elements(p_cart_items) AS item
WHERE (item->>'product_id')::uuid = ANY(v_eligible_product_ids);
ELSE
v_eligible_total := p_cart_total;
END IF;

IF v_coupon.discount_type = 'percentage' THEN
v_calculated_discount := v_eligible_total * (v_coupon.discount_value / 100);
-- Apply max discount cap
IF v_coupon.max_discount_amount IS NOT NULL AND v_calculated_discount > v_coupon.max_discount_amount THEN
v_calculated_discount := v_coupon.max_discount_amount;
END IF;
ELSE
-- fixed_amount
v_calculated_discount := LEAST(v_coupon.discount_value, v_eligible_total);
END IF;

-- Round to 2 decimal places
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
