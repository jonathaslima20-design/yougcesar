/*
  # Análise de produtos: consulta mais leve

  1. Changes
    - Índice (property_id, viewed_at) em property_views: as consultas filtram por produto e período.
    - get_product_analytics_summary: mesma assinatura e mesmo formato de retorno, mas a série
      semanal é calculada com uma agregação por dia (antes: uma varredura de property_views
      por produto e por dia, com ::date impedindo o uso do índice, e um JOIN que duplicava linhas).

  2. Notes
    - weekly_views continua com 7 entradas (dia e contagem), do mais antigo ao mais recente.
    - Nenhuma alteração de dados. Pode ser aplicada com segurança e rodada de novo.
*/

CREATE INDEX IF NOT EXISTS idx_property_views_property_viewed_at
  ON property_views (property_id, viewed_at);

CREATE OR REPLACE FUNCTION get_product_analytics_summary(
  p_user_id uuid,
  p_period_days integer DEFAULT 30
)
RETURNS TABLE(
  product_id uuid,
  views_count bigint,
  leads_count bigint,
  orders_count bigint,
  weekly_views jsonb
) AS $$
DECLARE
  start_date timestamptz;
  week_start date;
  week_end date;
BEGIN
  start_date := now() - (p_period_days || ' days')::interval;
  week_start := (now() - interval '6 days')::date;
  week_end := now()::date;

  RETURN QUERY
  WITH product_ids AS (
    SELECT p.id FROM products p WHERE p.user_id = p_user_id
  ),
  views_agg AS (
    SELECT pv.property_id AS pid, COUNT(*) AS cnt
    FROM property_views pv
    INNER JOIN product_ids pi ON pi.id = pv.property_id
    WHERE pv.viewed_at >= start_date
    GROUP BY pv.property_id
  ),
  leads_agg AS (
    SELECT l.property_id AS pid, COUNT(*) AS cnt
    FROM leads l
    INNER JOIN product_ids pi ON pi.id = l.property_id
    WHERE l.created_at >= start_date
    GROUP BY l.property_id
  ),
  orders_agg AS (
    SELECT oi.product_id AS pid, COUNT(DISTINCT oi.order_id) AS cnt
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN product_ids pi ON pi.id = oi.product_id
    WHERE o.created_at >= start_date
      AND o.store_owner_id = p_user_id
    GROUP BY oi.product_id
  ),
  -- Uma passada só sobre as visitas da semana, agrupadas por produto e dia.
  daily_views AS (
    SELECT pv.property_id AS pid, pv.viewed_at::date AS day, COUNT(*) AS cnt
    FROM property_views pv
    INNER JOIN product_ids pi ON pi.id = pv.property_id
    WHERE pv.viewed_at >= week_start::timestamptz
    GROUP BY pv.property_id, pv.viewed_at::date
  ),
  -- Os 7 dias de cada produto, com zero onde não houve visita.
  weekly_views_agg AS (
    SELECT
      pi.id AS pid,
      jsonb_agg(
        jsonb_build_object('day', d.day::date, 'count', COALESCE(dv.cnt, 0))
        ORDER BY d.day
      ) AS weekly
    FROM product_ids pi
    CROSS JOIN generate_series(week_start, week_end, interval '1 day') AS d(day)
    LEFT JOIN daily_views dv ON dv.pid = pi.id AND dv.day = d.day::date
    GROUP BY pi.id
  )
  SELECT
    pi.id AS product_id,
    COALESCE(va.cnt, 0) AS views_count,
    COALESCE(la.cnt, 0) AS leads_count,
    COALESCE(oa.cnt, 0) AS orders_count,
    COALESCE(wva.weekly, '[]'::jsonb) AS weekly_views
  FROM product_ids pi
  LEFT JOIN views_agg va ON va.pid = pi.id
  LEFT JOIN leads_agg la ON la.pid = pi.id
  LEFT JOIN orders_agg oa ON oa.pid = pi.id
  LEFT JOIN weekly_views_agg wva ON wva.pid = pi.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
