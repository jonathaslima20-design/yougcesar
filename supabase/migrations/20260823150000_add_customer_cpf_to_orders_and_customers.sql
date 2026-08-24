/*
  # Add customer CPF to orders and customers

  1. Contexto
    - O CPF do comprador era pedido tarde demais e de forma inconsistente:
      só aparecia dentro do pagamento PIX (OrderPaymentPage.tsx), validado
      apenas por contagem de dígitos (sem dígito verificador real), e nunca
      persistido em lugar nenhum — cada compra pedia de novo, mesmo de quem
      já tinha comprado antes. O pagamento por cartão já pedia CPF/CNPJ por
      outro caminho (campo próprio do Brick da Mercado Pago), então havia
      duas fontes divergentes para o mesmo dado.
    - Passa a ser coletado uma única vez, no checkout (CheckoutAddressPage.tsx,
      junto do WhatsApp), validado com dígito verificador real, gravado no
      pedido e também no perfil do comprador para pré-preencher nas próximas
      compras — e reaproveitado na tela de pagamento (PIX não pergunta de
      novo; o Brick de cartão recebe o valor pré-preenchido).

  2. Modified Tables
    - `orders`
      - `customer_cpf` (text, nullable) - snapshot do CPF/CNPJ informado no
        checkout, mesma convenção de `customer_name`/`customer_whatsapp`
        (não referencia `customers.cpf` ao vivo — o comprador pode editar o
        cadastro depois sem afetar pedidos já criados).
    - `customers`
      - `cpf` (text, nullable) - CPF/CNPJ do comprador, salvo após o primeiro
        checkout online para pré-preencher os próximos.

  3. Changes
    - Novo overload de `create_order_complete` com `p_customer_cpf text
      DEFAULT NULL` acrescentado como último parâmetro (mesma convenção
      append-only das migrations anteriores — todo overload existente é
      derrubado antes para o GRANT EXECUTE ficar sem ambiguidade).
      Chamadores existentes não são afetados: o parâmetro tem default NULL.
*/

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_cpf text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cpf text;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname = 'create_order_complete'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

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
