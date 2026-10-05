-- Charts, funnel and product ranking for the store dashboard, computed in the
-- database with the same definitions as get_store_metrics (20261005100000).
-- All three are SECURITY INVOKER: the caller's RLS limits them to their own store.
-- Days are bucketed in America/Sao_Paulo, the store's timezone.

-- Daily series for the last p_days days (oldest first): views and contacts per day.
CREATE OR REPLACE FUNCTION public.get_store_daily_series(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  SELECT auth.uid() AS owner_id,
         GREATEST(COALESCE(p_days, 7), 1) AS n_days,
         (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today
),
my_products AS (
  SELECT p.id FROM products p, params WHERE p.user_id = params.owner_id
),
days AS (
  SELECT g::date AS d
  FROM params, generate_series(params.today - (params.n_days - 1), params.today, interval '1 day') g
),
daily_views AS (
  SELECT (pv.viewed_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, count(*) AS n
  FROM property_views pv, params
  WHERE pv.property_id IN (SELECT id FROM my_products)
    AND pv.viewed_at >= ((params.today - (params.n_days - 1))::timestamp AT TIME ZONE 'America/Sao_Paulo')
  GROUP BY 1
),
daily_contacts AS (
  SELECT (l.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, count(*) AS n
  FROM leads l, params
  WHERE l.property_id IN (SELECT id FROM my_products)
    AND l.created_at >= ((params.today - (params.n_days - 1))::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND NOT (l.name = 'WhatsApp Contact' AND l.email = 'whatsapp@contact.com')
  GROUP BY 1
)
SELECT COALESCE(jsonb_agg(
  jsonb_build_object(
    'date', to_char(days.d, 'DD/MM'),
    'views', COALESCE(dv.n, 0),
    'contacts', COALESCE(dc.n, 0)
  ) ORDER BY days.d
), '[]'::jsonb)
FROM days
LEFT JOIN daily_views dv ON dv.d = days.d
LEFT JOIN daily_contacts dc ON dc.d = days.d;
$$;

-- Current and previous period figures for the funnel:
-- visitors, views, contacts, orders (not cancelled) and sales.
CREATE OR REPLACE FUNCTION public.get_store_funnel(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  SELECT auth.uid() AS owner_id,
         now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1)) AS since,
         now() - make_interval(days => 2 * GREATEST(COALESCE(p_days, 30), 1)) AS prev_since
),
my_products AS (
  SELECT p.id FROM products p, params WHERE p.user_id = params.owner_id
),
view_figures AS (
  SELECT
    count(*) FILTER (WHERE pv.viewed_at >= params.since) AS cur_views,
    count(DISTINCT pv.viewer_id) FILTER (WHERE pv.viewed_at >= params.since) AS cur_visitors,
    count(*) FILTER (WHERE pv.viewed_at < params.since) AS prev_views,
    count(DISTINCT pv.viewer_id) FILTER (WHERE pv.viewed_at < params.since) AS prev_visitors
  FROM property_views pv, params
  WHERE pv.property_id IN (SELECT id FROM my_products)
    AND pv.viewed_at >= params.prev_since
),
lead_figures AS (
  SELECT
    count(*) FILTER (WHERE l.created_at >= params.since) AS cur_contacts,
    count(*) FILTER (WHERE l.created_at < params.since) AS prev_contacts
  FROM leads l, params
  WHERE l.property_id IN (SELECT id FROM my_products)
    AND l.created_at >= params.prev_since
    AND NOT (l.name = 'WhatsApp Contact' AND l.email = 'whatsapp@contact.com')
),
order_figures AS (
  SELECT
    count(*) FILTER (WHERE o.created_at >= params.since) AS cur_orders,
    count(*) FILTER (WHERE o.created_at < params.since) AS prev_orders,
    count(*) FILTER (WHERE o.created_at >= params.since
      AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
      AND (o.order_type = 'whatsapp' OR o.payment_status = 'approved')) AS cur_sales,
    count(*) FILTER (WHERE o.created_at < params.since
      AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
      AND (o.order_type = 'whatsapp' OR o.payment_status = 'approved')) AS prev_sales
  FROM orders o, params
  WHERE o.store_owner_id = params.owner_id
    AND o.created_at >= params.prev_since
    AND o.status <> 'cancelled'
)
SELECT jsonb_build_object(
  'current', jsonb_build_object(
    'visitors', v.cur_visitors, 'views', v.cur_views,
    'contacts', l.cur_contacts, 'orders', o.cur_orders, 'sales', o.cur_sales),
  'previous', jsonb_build_object(
    'visitors', v.prev_visitors, 'views', v.prev_views,
    'contacts', l.prev_contacts, 'orders', o.prev_orders, 'sales', o.prev_sales)
)
FROM view_figures v, lead_figures l, order_figures o;
$$;

-- Top products by views in the period. "Trending" when the second half of the period
-- has 30% more views than the first half, or at least 5 views when the first half had none.
-- weekly_views is the last 7 days, oldest first.
CREATE OR REPLACE FUNCTION public.get_product_ranking(p_days integer DEFAULT 30, p_limit integer DEFAULT 5)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  SELECT auth.uid() AS owner_id,
         now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1)) AS since,
         now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1) / 2) AS mid,
         (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today
),
prods AS (
  SELECT p.id, p.title, p.featured_image_url
  FROM products p, params WHERE p.user_id = params.owner_id
),
view_stats AS (
  SELECT pv.property_id,
         count(*) AS views,
         count(DISTINCT pv.viewer_id) AS visitors,
         count(*) FILTER (WHERE pv.viewed_at >= params.mid) AS recent_views,
         count(*) FILTER (WHERE pv.viewed_at < params.mid) AS previous_views
  FROM property_views pv, params
  WHERE pv.property_id IN (SELECT id FROM prods)
    AND pv.viewed_at >= params.since
  GROUP BY pv.property_id
),
contact_stats AS (
  SELECT l.property_id, count(*) AS contacts
  FROM leads l, params
  WHERE l.property_id IN (SELECT id FROM prods)
    AND l.created_at >= params.since
    AND NOT (l.name = 'WhatsApp Contact' AND l.email = 'whatsapp@contact.com')
  GROUP BY l.property_id
),
week_views AS (
  SELECT pv.property_id, (pv.viewed_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, count(*) AS n
  FROM property_views pv, params
  WHERE pv.property_id IN (SELECT id FROM prods)
    AND pv.viewed_at >= ((params.today - 6)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  GROUP BY 1, 2
),
ranked AS (
  SELECT
    p.id,
    p.title,
    p.featured_image_url,
    COALESCE(vs.views, 0) AS views,
    COALESCE(cs.contacts, 0) AS contacts,
    CASE WHEN COALESCE(vs.visitors, 0) > 0
      THEN round(COALESCE(cs.contacts, 0)::numeric * 100 / vs.visitors, 1) ELSE 0 END AS contacts_per_visitor,
    CASE
      WHEN COALESCE(vs.previous_views, 0) > 0 THEN COALESCE(vs.recent_views, 0) > vs.previous_views * 1.3
      ELSE COALESCE(vs.recent_views, 0) >= 5
    END AS trending,
    (
      SELECT array_agg(COALESCE(wv.n, 0) ORDER BY g.d)
      FROM generate_series(params.today - 6, params.today, interval '1 day') g(d)
      LEFT JOIN week_views wv ON wv.property_id = p.id AND wv.d = g.d::date
    ) AS weekly_views
  FROM prods p
  CROSS JOIN params
  LEFT JOIN view_stats vs ON vs.property_id = p.id
  LEFT JOIN contact_stats cs ON cs.property_id = p.id
)
SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.views DESC), '[]'::jsonb)
FROM (
  SELECT id, title, featured_image_url, views, contacts,
         contacts_per_visitor, trending, weekly_views
  FROM ranked
  ORDER BY views DESC
  LIMIT GREATEST(COALESCE(p_limit, 5), 1)
) r;
$$;

REVOKE ALL ON FUNCTION public.get_store_daily_series(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_store_funnel(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_product_ranking(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_daily_series(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_funnel(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_ranking(integer, integer) TO authenticated;
