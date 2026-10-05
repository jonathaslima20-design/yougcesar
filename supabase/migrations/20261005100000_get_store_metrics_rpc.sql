-- Store dashboard metrics, computed in the database with one set of definitions.
--
-- Visitante:          distinct viewer_id in property_views for the store's products
-- Visualização:       property_views rows (one per visitor, product and day)
-- Contato:            leads for the store's products, excluding WhatsApp clicks
-- Clique no WhatsApp: leads written by trackWhatsAppClick (fixed name and email)
-- Pedido:             orders of the store, status other than cancelled
-- Venda:              pedido with status confirmed, preparing, shipped or delivered;
--                     online orders also need payment_status approved
-- Faturamento:        sum of orders.total over vendas
-- Compras por visitante (%) and Contatos por visitante (%)
--
-- SECURITY INVOKER on purpose: the caller's RLS policies decide what is visible,
-- so the function only ever counts the logged-in store owner's data.

CREATE OR REPLACE FUNCTION public.get_store_metrics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  SELECT auth.uid() AS owner_id,
         now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1)) AS since
),
my_products AS (
  SELECT p.id
  FROM products p, params
  WHERE p.user_id = params.owner_id
),
period_views AS (
  SELECT pv.viewer_id
  FROM property_views pv, params
  WHERE pv.property_id IN (SELECT id FROM my_products)
    AND pv.viewed_at >= params.since
),
period_leads AS (
  SELECT l.name, l.email
  FROM leads l, params
  WHERE l.property_id IN (SELECT id FROM my_products)
    AND l.created_at >= params.since
),
period_orders AS (
  SELECT o.status, o.order_type, o.payment_status, o.total
  FROM orders o, params
  WHERE o.store_owner_id = params.owner_id
    AND o.created_at >= params.since
    AND o.status <> 'cancelled'
),
figures AS (
  SELECT
    (SELECT count(*) FROM period_views) AS views,
    (SELECT count(DISTINCT viewer_id) FROM period_views) AS visitors,
    (SELECT count(*) FROM period_leads
      WHERE NOT (name = 'WhatsApp Contact' AND email = 'whatsapp@contact.com')) AS contacts,
    (SELECT count(*) FROM period_leads
      WHERE name = 'WhatsApp Contact' AND email = 'whatsapp@contact.com') AS whatsapp_clicks,
    (SELECT count(*) FROM period_orders) AS orders,
    (SELECT count(*) FROM period_orders
      WHERE status IN ('confirmed', 'preparing', 'shipped', 'delivered')
        AND (order_type = 'whatsapp' OR payment_status = 'approved')) AS sales,
    (SELECT COALESCE(sum(total), 0) FROM period_orders
      WHERE status IN ('confirmed', 'preparing', 'shipped', 'delivered')
        AND (order_type = 'whatsapp' OR payment_status = 'approved')) AS revenue
)
SELECT jsonb_build_object(
  'views', f.views,
  'visitors', f.visitors,
  'contacts', f.contacts,
  'whatsapp_clicks', f.whatsapp_clicks,
  'orders', f.orders,
  'sales', f.sales,
  'revenue', f.revenue,
  'purchases_per_visitor', CASE WHEN f.visitors > 0 THEN round(f.sales::numeric * 100 / f.visitors, 1) ELSE 0 END,
  'contacts_per_visitor', CASE WHEN f.visitors > 0 THEN round(f.contacts::numeric * 100 / f.visitors, 1) ELSE 0 END
)
FROM figures f;
$$;

REVOKE ALL ON FUNCTION public.get_store_metrics(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_metrics(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_store_metrics(integer) TO authenticated;
