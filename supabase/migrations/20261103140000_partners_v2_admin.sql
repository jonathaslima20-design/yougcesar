/*
  # Partners v2 — admin reporting and manual adjustments

  1. Changes
    - admin_partner_program_stats(): program KPIs for the admin overview
      (partners, activation, partner-sourced MRR vs. total, commissions,
      pending applications/withdrawals, open fraud flags).
    - admin_partner_list(): every partner with level, portfolio and sales
      metrics in one call.
    - admin_partner_adjustment(): manual credit/debit on a partner's ledger
      with an audit entry (e.g. goodwill bonus, correction).
    - All are admin-only (is_admin() check inside, anon revoked).
*/

CREATE OR REPLACE FUNCTION public.admin_partner_program_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;

  WITH active_subs AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_price / partner_cycle_months(s.billing_cycle::text) AS monthly
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id AND u.plan_status = 'active'
    WHERE s.status = 'active'
    ORDER BY s.user_id, s.next_payment_date DESC
  ),
  totals AS (
    SELECT
      COALESCE(SUM(a.monthly), 0) AS mrr_total,
      COALESCE(SUM(a.monthly) FILTER (WHERE u.managed_by_partner_id IS NOT NULL), 0) AS mrr_partners,
      COUNT(*) FILTER (WHERE u.managed_by_partner_id IS NOT NULL) AS paying_partner_clients,
      COUNT(*) AS paying_total
    FROM active_subs a JOIN users u ON u.id = a.user_id
  )
  SELECT jsonb_build_object(
    'partners_total', (SELECT count(*) FROM partner_profiles),
    'partners_approved', (SELECT count(*) FROM partner_profiles WHERE status = 'approved'),
    'partners_active_90d', (SELECT count(*) FROM partner_profiles WHERE status = 'approved' AND last_sale_at > now() - interval '90 days'),
    'partners_new_30d', (SELECT count(*) FROM partner_profiles WHERE approved_at > now() - interval '30 days'),
    'activation_rate', (
      SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE first_sale <= approved_at + interval '30 days') / count(*), 1) END
      FROM (
        SELECT pp.approved_at, (SELECT min(pc.created_at) FROM partner_commissions pc WHERE pc.partner_id = pp.user_id AND pc.type = 'new') AS first_sale
        FROM partner_profiles pp
        WHERE pp.approved_at < now() - interval '30 days'
      ) x
    ),
    'mrr_total', (SELECT round(mrr_total, 2) FROM totals),
    'mrr_partners', (SELECT round(mrr_partners, 2) FROM totals),
    'paying_partner_clients', (SELECT paying_partner_clients FROM totals),
    'paying_total', (SELECT paying_total FROM totals),
    'new_partner_clients_30d', (SELECT count(*) FROM partner_commissions WHERE type = 'new' AND created_at > now() - interval '30 days'),
    'commissions_month', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status <> 'reversed' AND created_at >= date_trunc('month', now())),
    'liability_holding', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status = 'holding'),
    'liability_available', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status IN ('available', 'requested')),
    'paid_total', (SELECT COALESCE(sum(amount), 0) FROM partner_commissions WHERE status = 'paid'),
    'applications_pending', (SELECT count(*) FROM partner_applications WHERE status IN ('pending', 'needs_info')),
    'withdrawals_pending', (SELECT count(*) FROM withdrawal_requests WHERE source = 'partner' AND status = 'pending'),
    'fraud_open', (SELECT count(*) FROM partner_fraud_flags WHERE status = 'open'),
    'churn_partner_clients_90d', (
      SELECT count(*) FROM users u
      WHERE u.managed_by_partner_id IS NOT NULL AND u.plan_status IN ('expired', 'suspended')
        AND u.plan_status_changed_at > now() - interval '90 days'
    ),
    'churn_organic_90d', (
      SELECT count(*) FROM users u
      WHERE u.managed_by_partner_id IS NULL AND u.role = 'corretor' AND u.plan_status IN ('expired', 'suspended')
        AND u.plan_status_changed_at > now() - interval '90 days'
    )
  ) INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_program_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_program_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_partner_list()
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  whatsapp text,
  company_name text,
  partner_type text,
  status text,
  level_id uuid,
  level_name text,
  rate numeric,
  is_founder boolean,
  payouts_frozen boolean,
  certified boolean,
  commission_override numeric,
  min_commission_percentage numeric,
  founder_bonus_pp numeric,
  public_slug text,
  approved_at timestamptz,
  last_sale_at timestamptz,
  clients_total integer,
  clients_active integer,
  mrr numeric,
  earned_total numeric,
  balance_available numeric,
  team_size integer,
  open_flags integer,
  admin_notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT
    pp.user_id, u.name, u.email, u.whatsapp, pp.company_name, pp.partner_type, pp.status,
    pp.level_id, l.name, partner_effective_rate(pp.user_id), pp.is_founder, pp.payouts_frozen,
    pp.certified_at IS NOT NULL, pp.commission_override, pp.min_commission_percentage, pp.founder_bonus_pp,
    pp.public_slug, pp.approved_at, pp.last_sale_at,
    (SELECT count(*)::integer FROM users c WHERE c.managed_by_partner_id = pp.user_id),
    st.active_clients, st.mrr,
    (SELECT COALESCE(sum(amount), 0) FROM partner_commissions pc WHERE pc.partner_id = pp.user_id AND pc.status <> 'reversed'),
    (SELECT COALESCE(sum(amount), 0) FROM partner_commissions pc WHERE pc.partner_id = pp.user_id AND pc.status = 'available'),
    (SELECT count(*)::integer FROM partner_team_members t WHERE t.partner_id = pp.user_id),
    (SELECT count(*)::integer FROM partner_fraud_flags f WHERE f.partner_id = pp.user_id AND f.status = 'open'),
    pp.admin_notes
  FROM partner_profiles pp
  JOIN users u ON u.id = pp.user_id
  LEFT JOIN partner_levels l ON l.id = pp.level_id
  CROSS JOIN LATERAL partner_portfolio_stats(pp.user_id) st
  ORDER BY st.mrr DESC, pp.approved_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_partner_adjustment(p_partner_id uuid, p_amount numeric, p_description text, p_available boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'Informe um valor diferente de zero.'; END IF;
  IF COALESCE(trim(p_description), '') = '' THEN RAISE EXCEPTION 'Informe o motivo do ajuste.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM partner_profiles WHERE user_id = p_partner_id) THEN RAISE EXCEPTION 'Parceiro não encontrado.'; END IF;

  INSERT INTO partner_commissions (partner_id, amount, type, status, available_at, description)
  VALUES (
    p_partner_id, round(p_amount, 2), 'adjustment',
    CASE WHEN p_available THEN 'available' ELSE 'holding' END,
    CASE WHEN p_available THEN now() ELSE now() + make_interval(days => (SELECT holding_days FROM partner_settings LIMIT 1)) END,
    left(trim(p_description), 300)
  ) RETURNING id INTO v_id;

  INSERT INTO partner_audit_log (partner_id, actor_id, action, details)
  VALUES (p_partner_id, auth.uid(), 'manual_adjustment', jsonb_build_object('amount', p_amount, 'description', p_description, 'commission_id', v_id));

  INSERT INTO notifications (user_id, type, title, message, related_entity_type)
  VALUES (p_partner_id, 'partner_commission',
          CASE WHEN p_amount > 0 THEN 'Crédito na sua conta de parceiro' ELSE 'Ajuste na sua conta de parceiro' END,
          left(trim(p_description), 200) || ' (R$ ' || to_char(p_amount, 'FM999G999G990D00') || ')', 'partner_commission');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_adjustment(uuid, numeric, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_adjustment(uuid, numeric, text, boolean) TO authenticated;

-- Admin reversal of a single commission (e.g. confirmed fraud).
CREATE OR REPLACE FUNCTION public.admin_partner_reverse_commission(p_commission_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r partner_commissions%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM partner_commissions WHERE id = p_commission_id FOR UPDATE;
  IF r.id IS NULL OR r.status = 'reversed' THEN RAISE EXCEPTION 'Comissão não encontrada ou já estornada.'; END IF;

  IF r.status IN ('holding', 'available') THEN
    UPDATE partner_commissions SET status = 'reversed', reversed_at = now(), reversal_reason = left(p_reason, 200) WHERE id = r.id;
  ELSE
    INSERT INTO partner_commissions (partner_id, managed_user_id, subscription_id, amount, type, status, available_at,
                                     source_commission_id, description, next_payment_date_at_generation, installment_number)
    VALUES (r.partner_id, r.managed_user_id, r.subscription_id, -r.amount, 'clawback', 'available', now(), r.id,
            'Estorno: ' || left(p_reason, 180), r.next_payment_date_at_generation, r.installment_number)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO partner_audit_log (partner_id, actor_id, action, target_user_id, details)
  VALUES (r.partner_id, auth.uid(), 'commission_reversed', r.managed_user_id, jsonb_build_object('commission_id', r.id, 'reason', p_reason));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_partner_reverse_commission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_partner_reverse_commission(uuid, text) TO authenticated;
