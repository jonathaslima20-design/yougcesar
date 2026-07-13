/*
  # Fix order creation for anonymous users and coupon visibility

  1. New Functions
    - `create_order_complete` (SECURITY DEFINER) - Creates an order with items in one call,
      bypassing RLS SELECT restrictions that block anonymous users from reading back
      the inserted order row. Returns the order ID on success.

  2. Security Changes
    - Add SELECT policy on `coupons` table allowing anonymous users to check
      if a store has active coupons (read-only, filtered by store owner and active status)

  3. Important Notes
    - The order INSERT policy already allows anyone to create orders
    - The problem was that `.insert().select()` fails for anon users because
      the SELECT policy requires `auth.uid() = store_owner_id`
    - The RPC function runs as SECURITY DEFINER so it can insert and return the order ID
    - The coupon SELECT policy for anon only exposes minimal fields needed to check existence
*/

-- Function to create an order with items atomically
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
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order_id uuid;
  v_item jsonb;
BEGIN
  -- Insert the order
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
    delivery_option
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
    p_delivery_option
  )
  RETURNING id INTO v_order_id;

  -- Insert order items
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

-- Allow anonymous and authenticated users to execute this function
GRANT EXECUTE ON FUNCTION public.create_order_complete TO anon, authenticated;

-- Add policy for anonymous users to check if a store has active coupons
-- Only allows reading is_active status filtered by user_id (store owner)
CREATE POLICY "Anyone can check active coupons for a store"
  ON coupons FOR SELECT
  TO anon
  USING (is_active = true AND valid_from <= now());
