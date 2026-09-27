/*
  # Admin "Vendas Online" dashboard RPCs

  ## Summary
  Read-only, admin-only aggregation functions behind /admin/online-sales:
  who has Mercado Pago connected, exact online-sales numbers (overall and per
  merchant), the platform's earnings from `application_fee`, and failed
  payments. No tables or columns are created or changed.

  ## Functions
  - `_order_payment_fee_cents(raw_response)` - the platform fee Mercado Pago
    itself reported for a payment, read from `fee_details` (entry of type
    `application_fee`). NULL when the payload has no such entry.
  - `admin_online_sales_overview(from, to, environment)` - totals, per-method
    breakdown, daily series and top failure reasons, as one jsonb.
  - `admin_online_sales_by_merchant(from, to, environment)` - one row per
    merchant that has either a Mercado Pago credentials row or any payment in
    the window: connection health + sales numbers.
  - `admin_failed_payments(from, to, environment, limit, offset)` - paginated
    list of rejected / cancelled / expired payment attempts.

  ## Notes
  - The platform fee is NOT stored in its own column: `merchant-payments`
    computes `application_fee` and only sends it to Mercado Pago. For approved
    payments we read the exact value back from `raw_response->fee_details`;
    if a payload lacks it we fall back to `amount * current fee_percentage`
    and flag the row as estimated (`fee_estimated_count` in the result).
  - Refunded / charged-back payments are excluded from earnings: Mercado Pago
    returns the marketplace fee on a refund, and our refund flow overwrites
    `raw_response` with the refund payload anyway.
  - The window filters on `order_payments.created_at` (when the attempt was
    made), in America/Sao_Paulo for the daily series.
  - Every function raises unless `public.is_admin()`, and never returns
    tokens or secrets - only boolean/date facts about the connection.
*/

CREATE OR REPLACE FUNCTION public._order_payment_fee_cents(p_raw jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_raw->'fee_details') = 'array' THEN (
      SELECT round(sum((f->>'amount')::numeric) * 100)::integer
      FROM jsonb_array_elements(p_raw->'fee_details') f
      WHERE f->>'type' = 'application_fee'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.admin_online_sales_overview(
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
  v_pct numeric;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(fee_percentage, 0) INTO v_pct
  FROM mercadopago_marketplace_config WHERE id = 1;
  v_pct := COALESCE(v_pct, 0);

  WITH p AS (
    SELECT
      op.store_owner_id,
      op.status,
      op.status_detail,
      op.payment_method,
      op.amount_cents,
      (op.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
      CASE WHEN op.status = 'approved' THEN
        COALESCE(public._order_payment_fee_cents(op.raw_response),
                 round(op.amount_cents * v_pct / 100)::integer)
      END AS fee_cents,
      (op.status = 'approved' AND public._order_payment_fee_cents(op.raw_response) IS NULL) AS fee_estimated
    FROM order_payments op
    WHERE op.environment = p_environment
      AND op.created_at >= p_from
      AND op.created_at < p_to
  )
  SELECT jsonb_build_object(
    'fee_percentage', v_pct,
    'totals', (
      SELECT jsonb_build_object(
        'attempts', count(*),
        'approved_count', count(*) FILTER (WHERE status = 'approved'),
        'approved_cents', COALESCE(sum(amount_cents) FILTER (WHERE status = 'approved'), 0),
        'fee_cents', COALESCE(sum(fee_cents) FILTER (WHERE status = 'approved'), 0),
        'fee_estimated_count', count(*) FILTER (WHERE fee_estimated),
        'refunded_count', count(*) FILTER (WHERE status IN ('refunded', 'charged_back')),
        'refunded_cents', COALESCE(sum(amount_cents) FILTER (WHERE status IN ('refunded', 'charged_back')), 0),
        'failed_count', count(*) FILTER (WHERE status IN ('rejected', 'cancelled')),
        'failed_cents', COALESCE(sum(amount_cents) FILTER (WHERE status IN ('rejected', 'cancelled')), 0),
        'expired_count', count(*) FILTER (WHERE status = 'expired'),
        'expired_cents', COALESCE(sum(amount_cents) FILTER (WHERE status = 'expired'), 0),
        'pending_count', count(*) FILTER (WHERE status NOT IN ('approved', 'refunded', 'charged_back', 'rejected', 'cancelled', 'expired')),
        'selling_merchants', count(DISTINCT store_owner_id) FILTER (WHERE status = 'approved')
      ) FROM p
    ),
    'by_method', (
      SELECT COALESCE(jsonb_agg(m ORDER BY m->>'method'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'method', payment_method,
          'approved_count', count(*) FILTER (WHERE status = 'approved'),
          'approved_cents', COALESCE(sum(amount_cents) FILTER (WHERE status = 'approved'), 0),
          'fee_cents', COALESCE(sum(fee_cents) FILTER (WHERE status = 'approved'), 0),
          'failed_count', count(*) FILTER (WHERE status IN ('rejected', 'cancelled', 'expired')),
          'attempts', count(*)
        ) AS m
        FROM p GROUP BY payment_method
      ) x
    ),
    'daily', (
      SELECT COALESCE(jsonb_agg(d ORDER BY d->>'day'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'day', day,
          'approved_count', count(*) FILTER (WHERE status = 'approved'),
          'approved_cents', COALESCE(sum(amount_cents) FILTER (WHERE status = 'approved'), 0),
          'fee_cents', COALESCE(sum(fee_cents) FILTER (WHERE status = 'approved'), 0),
          'failed_count', count(*) FILTER (WHERE status IN ('rejected', 'cancelled', 'expired'))
        ) AS d
        FROM p GROUP BY day
      ) x
    ),
    'failure_reasons', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'count')::int DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'reason', COALESCE(NULLIF(status_detail, ''), status),
          'count', count(*),
          'cents', COALESCE(sum(amount_cents), 0)
        ) AS r
        FROM p
        WHERE status IN ('rejected', 'cancelled', 'expired')
        GROUP BY COALESCE(NULLIF(status_detail, ''), status)
        ORDER BY count(*) DESC
        LIMIT 10
      ) x
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_online_sales_by_merchant(
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
  v_pct numeric;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(fee_percentage, 0) INTO v_pct
  FROM mercadopago_marketplace_config WHERE id = 1;
  v_pct := COALESCE(v_pct, 0);

  WITH p AS (
    SELECT
      op.store_owner_id,
      op.status,
      op.amount_cents,
      op.created_at,
      CASE WHEN op.status = 'approved' THEN
        COALESCE(public._order_payment_fee_cents(op.raw_response),
                 round(op.amount_cents * v_pct / 100)::integer)
      END AS fee_cents
    FROM order_payments op
    WHERE op.environment = p_environment
      AND op.created_at >= p_from
      AND op.created_at < p_to
  ),
  agg AS (
    SELECT
      store_owner_id,
      count(*) AS attempts,
      count(*) FILTER (WHERE status = 'approved') AS approved_count,
      COALESCE(sum(amount_cents) FILTER (WHERE status = 'approved'), 0) AS approved_cents,
      COALESCE(sum(fee_cents) FILTER (WHERE status = 'approved'), 0) AS fee_cents,
      count(*) FILTER (WHERE status IN ('rejected', 'cancelled')) AS failed_count,
      count(*) FILTER (WHERE status = 'expired') AS expired_count,
      count(*) FILTER (WHERE status IN ('refunded', 'charged_back')) AS refunded_count,
      COALESCE(sum(amount_cents) FILTER (WHERE status IN ('refunded', 'charged_back')), 0) AS refunded_cents,
      max(created_at) FILTER (WHERE status = 'approved') AS last_sale_at
    FROM p
    GROUP BY store_owner_id
  )
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'approved_cents')::bigint DESC, row_data->>'name'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'user_id', u.id,
      'name', u.name,
      'email', u.email,
      'slug', u.slug,
      'has_credentials', c.id IS NOT NULL,
      'is_active', COALESCE(c.is_active, false),
      'environment', c.environment,
      'oauth_connected', COALESCE(c.refresh_token, '') <> '',
      'has_token', (COALESCE(c.access_token_prod, '') <> '' OR COALESCE(c.access_token_test, '') <> ''),
      'mp_account_email', NULLIF(c.mp_account_email, ''),
      'mp_user_id', c.mp_user_id,
      'token_expires_at', c.token_expires_at,
      'last_validated_at', c.last_validated_at,
      'connected_since', c.created_at,
      'attempts', COALESCE(a.attempts, 0),
      'approved_count', COALESCE(a.approved_count, 0),
      'approved_cents', COALESCE(a.approved_cents, 0),
      'fee_cents', COALESCE(a.fee_cents, 0),
      'failed_count', COALESCE(a.failed_count, 0),
      'expired_count', COALESCE(a.expired_count, 0),
      'refunded_count', COALESCE(a.refunded_count, 0),
      'refunded_cents', COALESCE(a.refunded_cents, 0),
      'last_sale_at', a.last_sale_at
    ) AS row_data
    FROM users u
    LEFT JOIN merchant_payment_credentials c
      ON c.user_id = u.id AND c.provider = 'mercadopago'
    LEFT JOIN agg a ON a.store_owner_id = u.id
    WHERE c.id IS NOT NULL OR a.store_owner_id IS NOT NULL
  ) x;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_failed_payments(
  p_from timestamptz,
  p_to timestamptz,
  p_environment text DEFAULT 'production',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total integer;
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM order_payments op
  WHERE op.environment = p_environment
    AND op.created_at >= p_from
    AND op.created_at < p_to
    AND op.status IN ('rejected', 'cancelled', 'expired');

  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'created_at') DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', op.id,
      'created_at', op.created_at,
      'status', op.status,
      'status_detail', op.status_detail,
      'payment_method', op.payment_method,
      'card_brand', NULLIF(op.card_brand, ''),
      'installments', op.installments,
      'amount_cents', op.amount_cents,
      'payer_email', NULLIF(op.payer_email, ''),
      'order_id', op.order_id,
      'mp_payment_id', op.mp_payment_id,
      'customer_name', o.customer_name,
      'store_owner_id', op.store_owner_id,
      'store_name', u.name,
      'store_slug', u.slug
    ) AS row_data
    FROM order_payments op
    LEFT JOIN orders o ON o.id = op.order_id
    LEFT JOIN users u ON u.id = op.store_owner_id
    WHERE op.environment = p_environment
      AND op.created_at >= p_from
      AND op.created_at < p_to
      AND op.status IN ('rejected', 'cancelled', 'expired')
    ORDER BY op.created_at DESC
    LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  ) x;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public._order_payment_fee_cents(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._order_payment_fee_cents(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_online_sales_overview(timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_online_sales_by_merchant(timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_failed_payments(timestamptz, timestamptz, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_online_sales_overview(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_online_sales_by_merchant(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_failed_payments(timestamptz, timestamptz, text, integer, integer) TO authenticated;
