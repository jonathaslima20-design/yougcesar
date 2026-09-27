/*
  # Admin "Ranking de lojistas" RPC

  ## Summary
  Read-only, admin-only function behind the "Ranking" tab of /admin/online-sales:
  how many orders each merchant receives, split by origin — WhatsApp orders vs
  orders paid online — so the admin can rank merchants by either origin or both.
  No tables or columns are created or changed.

  ## Function
  - `admin_orders_ranking(from, to, environment)` - jsonb array, one element per
    merchant with at least one order in the window, always carrying BOTH origins
    (`whatsapp_*` and `online_*`) so the UI can switch the origin filter
    instantly without another round trip.

  ## Counting rules
  - WhatsApp: rows of `orders` with `order_type = 'whatsapp'` and
    `status <> 'cancelled'`. The value is the cart total the buyer declared, NOT
    confirmed money — the merchant is the one who moves the status along.
  - Online: rows of `order_payments` with `status = 'approved'` in the chosen
    `environment` (refunded / charged-back payments are no longer 'approved', so
    they drop out). The value is what was actually paid.
  - The window filters on `created_at` of the order / payment attempt, same as
    the other Vendas Online functions. `environment` only affects the online side.
  - Raises unless `public.is_admin()`; returns no tokens or secrets.
*/

CREATE OR REPLACE FUNCTION public.admin_orders_ranking(
  p_from timestamptz,
  p_to timestamptz,
  p_environment text DEFAULT 'production'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH wa AS (
    SELECT
      o.store_owner_id,
      count(*) AS n_orders,
      COALESCE(sum(round(o.total * 100)), 0)::bigint AS cents,
      max(o.created_at) AS last_at
    FROM orders o
    WHERE o.order_type = 'whatsapp'
      AND o.status <> 'cancelled'
      AND o.created_at >= p_from
      AND o.created_at < p_to
    GROUP BY o.store_owner_id
  ),
  online AS (
    SELECT
      op.store_owner_id,
      count(*) AS n_orders,
      COALESCE(sum(op.amount_cents), 0)::bigint AS cents,
      max(op.created_at) AS last_at
    FROM order_payments op
    WHERE op.status = 'approved'
      AND op.environment = p_environment
      AND op.created_at >= p_from
      AND op.created_at < p_to
    GROUP BY op.store_owner_id
  )
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'total_orders')::bigint DESC, row_data->>'name'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'user_id', u.id,
      'name', u.name,
      'email', u.email,
      'slug', u.slug,
      'whatsapp_orders', COALESCE(wa.n_orders, 0),
      'whatsapp_cents', COALESCE(wa.cents, 0),
      'online_orders', COALESCE(online.n_orders, 0),
      'online_cents', COALESCE(online.cents, 0),
      'total_orders', COALESCE(wa.n_orders, 0) + COALESCE(online.n_orders, 0),
      'last_order_at', GREATEST(wa.last_at, online.last_at)
    ) AS row_data
    FROM wa
    FULL JOIN online ON online.store_owner_id = wa.store_owner_id
    JOIN users u ON u.id = COALESCE(wa.store_owner_id, online.store_owner_id)
  ) x;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_orders_ranking(timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_orders_ranking(timestamptz, timestamptz, text) TO authenticated;
