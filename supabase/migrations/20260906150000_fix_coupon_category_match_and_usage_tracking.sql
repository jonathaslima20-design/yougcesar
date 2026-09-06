/*
  # Fix coupon category matching and missing usage tracking

  1. Problem 0: coupon_categories.category_id has the wrong column type
     - Confirmed live against production: `coupon_categories.category_id`
       is `uuid`. But categories in this project are never a UUID-keyed
       entity — `products.category` is a `text[]` of plain names, and
       every other category-related table (`category_display_settings`,
       `affiliate_commission_rules.category_name`) keys by name (text).
       There is no `categories` table for a uuid to reference.
     - This means the column was miscreated from the start: no coupon
       could ever have a working category association through it, since
       the app only ever has category *names* to store, not uuids.
     - Fix: convert the column to text so it can actually hold a category
       name. Safe regardless of current contents (any pre-existing value
       is cast to its text form via `USING`); the frontend bug below
       meant this table was in practice never populated with real data
       anyway.

  2. Problem 1: category-scoped coupons can never be applied
     - `validate_coupon` matched eligible products with
       `coupon_categories cc ON cc.category_id = p.category_id`, but
       `products` has no `category_id` column at all. The join always
       failed, so a `specific_categories` coupon could never find an
       eligible product and always returned "Nenhum produto elegível".
     - Fix: join with `cc.category_id = ANY(p.category)` instead, matching
       by name (only valid now that Problem 0 is fixed).

  3. Problem 2: coupon usage is never recorded
     - `create_order_complete` never inserted into `coupon_usages` nor
       incremented `coupons.current_uses`, so `max_uses` and
       `max_uses_per_customer` had no effect — a coupon could be reused
       past its configured limit, and the merchant's usage stats always
       showed zero.
     - Fix: when an order is created with a coupon, insert a
       `coupon_usages` row and bump `coupons.current_uses`.
*/

ALTER TABLE public.coupon_categories
  ALTER COLUMN category_id TYPE text USING category_id::text;

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
-- coupon_categories.category_id stores a category NAME (text), matching
-- products.category (text[]) — products have no category_id FK.
SELECT ARRAY_AGG(DISTINCT p.id) INTO v_eligible_product_ids
FROM products p
INNER JOIN coupon_categories cc ON cc.category_id = ANY(p.category)
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

-- Re-create create_order_complete with the same signature as the latest
-- overload, adding coupon usage tracking right after the order is inserted.
CREATE OR REPLACE FUNCTION public.create_order_complete(
  p_store_owner_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_customer_country_code text DEFAULT '55',
  p_order_type text DEFAULT 'whatsapp',
  p_subtotal numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_whatsapp_message text DEFAULT '',
  p_source text DEFAULT 'cart',
  p_coupon_id uuid DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT NULL,
  p_payment_method_discount numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_delivery_option text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_buyer_id uuid DEFAULT NULL,
  p_payment_status text DEFAULT 'not_applicable',
  p_shipping_street text DEFAULT NULL,
  p_shipping_number text DEFAULT NULL,
  p_shipping_complement text DEFAULT NULL,
  p_shipping_neighborhood text DEFAULT NULL,
  p_shipping_city text DEFAULT NULL,
  p_shipping_state text DEFAULT NULL,
  p_shipping_zip_code text DEFAULT NULL,
  p_insurance_fee numeric DEFAULT 0,
  p_affiliate_id uuid DEFAULT NULL,
  p_delivery_scope text DEFAULT NULL,
  p_delivery_is_quote boolean DEFAULT false,
  p_pickup_instructions text DEFAULT NULL,
  p_customer_cpf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_affiliate_id uuid := p_affiliate_id;
BEGIN
  IF v_affiliate_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.affiliates a
      JOIN public.users u ON u.id = a.store_owner_id
      WHERE a.id = v_affiliate_id
        AND a.store_owner_id = p_store_owner_id
        AND a.status = 'active'
        AND u.affiliate_program_enabled = true
    ) THEN
      v_affiliate_id := NULL;
    END IF;
  END IF;

  INSERT INTO orders (
    store_owner_id,
    customer_name,
    customer_whatsapp,
    customer_country_code,
    order_type,
    subtotal,
    total,
    notes,
    whatsapp_message,
    source,
    coupon_id,
    coupon_code,
    discount_amount,
    payment_method,
    payment_method_discount,
    delivery_fee,
    delivery_option,
    buyer_id,
    payment_status,
    shipping_street,
    shipping_number,
    shipping_complement,
    shipping_neighborhood,
    shipping_city,
    shipping_state,
    shipping_zip_code,
    insurance_fee,
    affiliate_id,
    delivery_scope,
    delivery_is_quote,
    pickup_instructions,
    customer_cpf
  ) VALUES (
    p_store_owner_id,
    p_customer_name,
    p_customer_whatsapp,
    p_customer_country_code,
    p_order_type,
    p_subtotal,
    p_total,
    p_notes,
    p_whatsapp_message,
    p_source,
    p_coupon_id,
    p_coupon_code,
    p_discount_amount,
    p_payment_method,
    p_payment_method_discount,
    p_delivery_fee,
    p_delivery_option,
    p_buyer_id,
    p_payment_status,
    p_shipping_street,
    p_shipping_number,
    p_shipping_complement,
    p_shipping_neighborhood,
    p_shipping_city,
    p_shipping_state,
    p_shipping_zip_code,
    p_insurance_fee,
    v_affiliate_id,
    p_delivery_scope,
    p_delivery_is_quote,
    p_pickup_instructions,
    p_customer_cpf
  )
  RETURNING id INTO v_order_id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO order_items (
        order_id,
        product_id,
        product_title,
        product_image_url,
        quantity,
        unit_price,
        selected_color,
        selected_size,
        selected_flavor,
        selected_variant_label,
        item_notes,
        subtotal
      ) VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        COALESCE(v_item->>'product_title', ''),
        COALESCE(v_item->>'product_image_url', ''),
        COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0),
        v_item->>'selected_color',
        v_item->>'selected_size',
        v_item->>'selected_flavor',
        v_item->>'selected_variant_label',
        COALESCE(v_item->>'item_notes', ''),
        COALESCE((v_item->>'subtotal')::numeric, 0)
      );
    END LOOP;
  END IF;

  -- Record coupon usage: previously nothing ever wrote to coupon_usages or
  -- bumped coupons.current_uses, so max_uses / max_uses_per_customer had no
  -- effect and the merchant's usage stats always read zero.
  IF p_coupon_id IS NOT NULL THEN
    INSERT INTO coupon_usages (
      coupon_id,
      customer_whatsapp,
      discount_applied,
      used_at
    ) VALUES (
      p_coupon_id,
      p_customer_whatsapp,
      p_discount_amount,
      now()
    );

    UPDATE coupons
    SET current_uses = current_uses + 1
    WHERE id = p_coupon_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_order_complete TO anon, authenticated;
