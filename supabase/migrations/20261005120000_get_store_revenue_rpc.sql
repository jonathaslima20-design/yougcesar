-- Revenue for the store dashboard (Faturamento, Ticket Médio, Pedidos Entregues and
-- the weekly chart), with the same definition of "venda" as get_store_metrics:
-- status confirmed, preparing, shipped or delivered, and for online orders
-- payment_status approved. Previously the card counted unpaid online orders too.
--
-- weekly: 7 buckets, oldest first, same bucketing as the dashboard always used
-- (bucket width is period/7 days, at least 1). Days are in America/Sao_Paulo.
-- SECURITY INVOKER: the caller's RLS limits it to their own orders.

CREATE OR REPLACE FUNCTION public.get_store_revenue(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH params AS (
  SELECT auth.uid() AS owner_id,
         GREATEST(COALESCE(p_days, 30), 1) AS n_days,
         GREATEST(GREATEST(COALESCE(p_days, 30), 1) / 7, 1) AS step,
         now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1)) AS since,
         now() - make_interval(days => 2 * GREATEST(COALESCE(p_days, 30), 1)) AS prev_since,
         (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today
),
sales AS (
  SELECT o.created_at, o.total, o.status
  FROM orders o, params
  WHERE o.store_owner_id = params.owner_id
    AND o.created_at >= params.prev_since
    AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
    AND (o.order_type = 'whatsapp' OR o.payment_status = 'approved')
),
totals AS (
  SELECT
    COALESCE(sum(s.total) FILTER (WHERE s.created_at >= params.since), 0) AS total_revenue,
    COALESCE(sum(s.total) FILTER (WHERE s.created_at < params.since), 0) AS previous_revenue,
    count(*) FILTER (WHERE s.created_at >= params.since) AS sales_count,
    count(*) FILTER (WHERE s.created_at >= params.since AND s.status = 'delivered') AS delivered_count
  FROM sales s, params
),
buckets AS (
  SELECT g.i,
         params.today - g.i * params.step AS end_day,
         params.today - g.i * params.step - params.step + 1 AS start_day
  FROM params, generate_series(6, 0, -1) AS g(i)
),
weekly AS (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', to_char(b.end_day, 'DD/MM'),
      'revenue', COALESCE(r.amount, 0)
    ) ORDER BY b.end_day
  ), '[]'::jsonb) AS series
  FROM buckets b
  LEFT JOIN LATERAL (
    SELECT sum(s.total) AS amount
    FROM sales s
    WHERE (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN b.start_day AND b.end_day
  ) r ON true
)
SELECT jsonb_build_object(
  'total_revenue', t.total_revenue,
  'previous_revenue', t.previous_revenue,
  'sales', t.sales_count,
  'delivered', t.delivered_count,
  'weekly', w.series
)
FROM totals t, weekly w;
$$;

REVOKE ALL ON FUNCTION public.get_store_revenue(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_revenue(integer) TO authenticated;
