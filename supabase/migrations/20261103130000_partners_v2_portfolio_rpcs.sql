/*
  # Partners v2 — portfolio, funnel and store-consent RPCs

  1. Changes
    - partner_clients(): the caller's portfolio with store health signals
      (products, orders in 30 days, custom domain, last login, subscription,
      consent, origin, commissions). Partners can't read clients' products or
      orders through RLS, so these are aggregated server-side and only for
      clients managed by the caller's partner scope.
    - partner_funnel(p_days): clicks → signups → paying, per link.
    - accept_partner_store_invite(p_grant): the client records whether the
      partner keeps manager access when taking over a store built for them.
    - set_partner_store_access(p_grant): the client toggles that consent later
      from their own dashboard.
*/

CREATE OR REPLACE FUNCTION public.partner_clients()
RETURNS TABLE (
  id uuid,
  name text,
  owner_name text,
  email text,
  whatsapp text,
  slug text,
  plan_status text,
  trial_ends_at timestamptz,
  is_blocked boolean,
  created_at timestamptz,
  last_login_at timestamptz,
  plan_name text,
  plan_price numeric,
  billing_cycle text,
  next_payment_date date,
  monthly_value numeric,
  products_count integer,
  orders_30d integer,
  has_custom_domain boolean,
  access_granted boolean,
  client_accepted boolean,
  origin text,
  commission_total numeric,
  health text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH scope AS (
    SELECT public.partner_scope_id() AS pid, public.partner_team_role() AS role
  )
  SELECT
    u.id, u.name, u.owner_name, u.email, u.whatsapp, u.slug, u.plan_status, u.trial_ends_at, u.is_blocked,
    u.created_at, u.last_login_at,
    s.plan_name, s.plan_price, s.billing_cycle::text, s.next_payment_date::date,
    CASE WHEN s.plan_price IS NOT NULL THEN round(s.plan_price / public.partner_cycle_months(s.billing_cycle::text), 2) END,
    COALESCE(p.cnt, 0)::integer,
    COALESCE(o.cnt, 0)::integer,
    EXISTS (SELECT 1 FROM custom_domains d WHERE d.user_id = u.id AND d.status = 'active'),
    COALESCE(sa.granted, false),
    sa.client_accepted_at IS NOT NULL OR sa.store_user_id IS NULL,
    COALESCE(a.source, 'legacy'),
    CASE WHEN (SELECT role FROM scope) = 'owner' THEN COALESCE(c.total, 0) END,
    CASE
      WHEN u.is_blocked THEN 'blocked'
      WHEN u.plan_status IN ('expired', 'suspended', 'trial_expired') THEN 'lapsed'
      WHEN u.plan_status = 'trial' AND u.trial_ends_at < now() + interval '3 days' THEN 'at_risk'
      WHEN u.plan_status = 'active' AND s.next_payment_date IS NOT NULL AND s.next_payment_date < now() + interval '5 days' THEN 'renewing'
      WHEN COALESCE(p.cnt, 0) = 0 THEN 'setup'
      WHEN COALESCE(u.last_login_at, u.created_at) < now() - interval '21 days' AND COALESCE(o.cnt, 0) = 0 THEN 'at_risk'
      ELSE 'healthy'
    END
  FROM users u
  CROSS JOIN scope
  LEFT JOIN LATERAL (
    SELECT sub.plan_name, sub.plan_price, sub.billing_cycle, sub.next_payment_date
    FROM subscriptions sub WHERE sub.user_id = u.id
    ORDER BY (sub.status = 'active') DESC, sub.next_payment_date DESC NULLS LAST
    LIMIT 1
  ) s ON true
  LEFT JOIN LATERAL (SELECT count(*) cnt FROM products pr WHERE pr.user_id = u.id) p ON true
  LEFT JOIN LATERAL (
    SELECT count(*) cnt FROM orders ord WHERE ord.store_owner_id = u.id AND ord.created_at > now() - interval '30 days'
  ) o ON true
  LEFT JOIN partner_store_access sa ON sa.store_user_id = u.id
  LEFT JOIN partner_attributions a ON a.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT sum(amount) total FROM partner_commissions pc
    WHERE pc.managed_user_id = u.id AND pc.partner_id = scope.pid AND pc.status <> 'reversed'
  ) c ON true
  WHERE scope.role IS NOT NULL
    AND u.managed_by_partner_id = scope.pid
  ORDER BY u.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.partner_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_clients() TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_funnel(p_days integer DEFAULT 30)
RETURNS TABLE (
  link_id uuid,
  link_name text,
  link_slug text,
  clicks integer,
  signups integer,
  paying integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH scope AS (SELECT public.partner_scope_id() AS pid, public.partner_team_role() AS role),
  since AS (SELECT now() - make_interval(days => GREATEST(LEAST(COALESCE(p_days, 30), 365), 1)) AS t)
  SELECT
    l.id, l.name, l.slug,
    (SELECT count(*) FROM partner_clicks c, since WHERE c.link_id = l.id AND c.created_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a, since WHERE a.link_id = l.id AND a.attributed_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a JOIN users u ON u.id = a.user_id, since
      WHERE a.link_id = l.id AND a.attributed_at >= since.t AND u.plan_status = 'active')::integer
  FROM partner_links l, scope
  WHERE scope.role IS NOT NULL AND l.partner_id = scope.pid
  UNION ALL
  -- Signups not tied to a specific link (direct creation, legacy ?ref, leads, coupons on the default link…)
  SELECT
    NULL, 'Sem link específico', NULL,
    (SELECT count(*) FROM partner_clicks c, since, scope WHERE c.partner_id = scope.pid AND c.link_id IS NULL AND c.created_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a, since, scope WHERE a.partner_id = scope.pid AND a.link_id IS NULL AND a.attributed_at >= since.t)::integer,
    (SELECT count(*) FROM partner_attributions a JOIN users u ON u.id = a.user_id, since, scope
      WHERE a.partner_id = scope.pid AND a.link_id IS NULL AND a.attributed_at >= since.t AND u.plan_status = 'active')::integer
  FROM scope WHERE scope.role IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.partner_funnel(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_funnel(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_partner_store_invite(p_grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE partner_store_access
  SET client_accepted_at = COALESCE(client_accepted_at, now()),
      granted = p_grant,
      granted_at = CASE WHEN p_grant THEN now() ELSE granted_at END,
      revoked_at = CASE WHEN p_grant THEN NULL ELSE now() END,
      updated_at = now()
  WHERE store_user_id = auth.uid();

  INSERT INTO partner_audit_log (partner_id, actor_id, action, target_user_id, details)
  SELECT partner_id, auth.uid(), 'client_accepted_store', auth.uid(), jsonb_build_object('manager_access', p_grant)
  FROM partner_store_access WHERE store_user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.accept_partner_store_invite(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_partner_store_invite(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_partner_store_access(p_grant boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner uuid;
BEGIN
  SELECT managed_by_partner_id INTO v_partner FROM users WHERE id = auth.uid();
  IF v_partner IS NULL THEN RAISE EXCEPTION 'Sua loja não é gerenciada por um parceiro.'; END IF;

  INSERT INTO partner_store_access (store_user_id, partner_id, granted, client_accepted_at)
  VALUES (auth.uid(), v_partner, p_grant, now())
  ON CONFLICT (store_user_id) DO UPDATE SET granted = EXCLUDED.granted;

  INSERT INTO partner_audit_log (partner_id, actor_id, action, target_user_id, details)
  VALUES (v_partner, auth.uid(), CASE WHEN p_grant THEN 'store_access_granted' ELSE 'store_access_revoked' END, auth.uid(), '{}'::jsonb);

  INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
  SELECT v_partner, 'partner_store_access',
         CASE WHEN p_grant THEN 'Acesso de gestor liberado' ELSE 'Acesso de gestor revogado' END,
         COALESCE(name, 'Um cliente') || CASE WHEN p_grant THEN ' liberou' ELSE ' revogou' END || ' o seu acesso para gerenciar a loja.',
         auth.uid(), 'partner_store_access'
  FROM users WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.set_partner_store_access(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_partner_store_access(boolean) TO authenticated;

-- Store owners can see who manages them (for the consent card).
CREATE OR REPLACE FUNCTION public.my_store_partner()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'partner_name', COALESCE(pp.company_name, p.name),
    'partner_whatsapp', p.whatsapp,
    'granted', COALESCE(sa.granted, false),
    'has_access_record', sa.store_user_id IS NOT NULL
  )
  FROM users u
  JOIN users p ON p.id = u.managed_by_partner_id
  LEFT JOIN partner_profiles pp ON pp.user_id = p.id
  LEFT JOIN partner_store_access sa ON sa.store_user_id = u.id
  WHERE u.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_store_partner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_store_partner() TO authenticated;
