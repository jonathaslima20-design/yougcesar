/*
  # Let merchants opt coupons in to the buyer's account area

  1. Problem
     - The buyer's "Visão Geral" should surface coupons the store wants to
       promote ("Ofertas para você"). Coupons had no notion of audience: many
       are private on purpose (influencer/affiliate codes, one-off recovery
       codes), so listing every active coupon would leak them and cost the
       merchant money.

  2. Change
     - `coupons.show_to_customers boolean NOT NULL DEFAULT false` — strictly
       opt-in per coupon; existing coupons stay hidden.
     - `list_customer_visible_coupons(p_store_slug)` — SECURITY DEFINER RPC,
       callable by signed-in buyers only, returns just the display fields of
       opted-in coupons that are currently usable (active, started, not
       expired, not exhausted). No RLS change on `coupons` itself.
*/

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS show_to_customers boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION list_customer_visible_coupons(p_store_slug text)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_order_value numeric,
  max_discount_amount numeric,
  valid_until timestamptz,
  applies_to text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id::uuid, c.code::text, c.discount_type::text, c.discount_value::numeric,
         c.min_order_value::numeric, c.max_discount_amount::numeric,
         c.valid_until::timestamptz, c.applies_to::text
  FROM coupons c
  JOIN users u ON u.id = c.user_id
  WHERE auth.uid() IS NOT NULL
    AND u.slug = p_store_slug
    AND u.role = 'corretor'
    AND c.show_to_customers = true
    AND c.is_active = true
    AND c.valid_from <= now()
    AND (c.valid_until IS NULL OR c.valid_until > now())
    AND (c.max_uses IS NULL OR c.current_uses < c.max_uses)
  ORDER BY c.created_at DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION list_customer_visible_coupons(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_customer_visible_coupons(text) FROM anon;
GRANT EXECUTE ON FUNCTION list_customer_visible_coupons(text) TO authenticated;
