-- VitrineTurbo Partners: comissão integral liberada em 24h (rode depois do 02).
-- Cole tudo no SQL Editor do Supabase e clique em Run. Transação única.

BEGIN;

/*
  # Partners: full commission available 24h after the sale

  1. Settings
    - holding_days = 1 (24h) and annual_installments = false: an annual plan
      now pays its whole commission at once, released 24h after payment.
    - Column defaults follow, so a fresh database starts with the same rules.
  2. Existing commissions
    - Commissions still in holding are released 24h after they were created
      (including future installments of annual plans).
  3. Release cadence
    - partner_release_commissions() runs every hour (pg_cron), so a commission
      is released within the hour after its 24h, instead of waiting for the
      daily maintenance at 03:15.
  4. Academy hidden for now
    - Level certification requirement off and "Academia" removed from level
      benefits, since partners can no longer reach the academy.
  5. Public info exposes recruit_override_months, and the commission
     notification says "em 24 horas" instead of "em 1 dias".
*/

UPDATE public.partner_settings SET holding_days = 1, annual_installments = false;
ALTER TABLE public.partner_settings ALTER COLUMN holding_days SET DEFAULT 1;
ALTER TABLE public.partner_settings ALTER COLUMN annual_installments SET DEFAULT false;

UPDATE public.partner_commissions
SET available_at = created_at + interval '1 day'
WHERE status = 'holding' AND available_at > created_at + interval '1 day';

UPDATE public.partner_levels SET requires_certification = false WHERE requires_certification;
UPDATE public.partner_levels SET benefits = array_remove(benefits, 'Academia VitrineTurbo');

-- ---------------------------------------------------------------------------
-- Hourly release (same rule as the daily maintenance: suspended partners wait)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_release_commissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer;
BEGIN
  UPDATE partner_commissions pc SET status = 'available'
  WHERE pc.status = 'holding' AND pc.available_at <= now()
    AND NOT EXISTS (
      SELECT 1 FROM partner_profiles pp WHERE pp.user_id = pc.partner_id AND pp.status = 'suspended'
    );
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;
REVOKE ALL ON FUNCTION public.partner_release_commissions() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'partner-release-commissions';
    PERFORM cron.schedule('partner-release-commissions', '5 * * * *', 'SELECT public.partner_release_commissions();');
  END IF;
END $$;

SELECT public.partner_release_commissions();

-- ---------------------------------------------------------------------------
-- Public info: add recruit_override_months
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_partner_program_public_info()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'is_active', s.is_active,
    'holding_days', s.holding_days,
    'first_sale_bonus_amount', s.first_sale_bonus_amount,
    'first_sale_bonus_days', s.first_sale_bonus_days,
    'recruit_override_percentage', s.recruit_override_percentage,
    'recruit_override_months', s.recruit_override_months,
    'store_trial_days', s.store_trial_days,
    'minimum_withdrawal_amount', s.minimum_withdrawal_amount,
    'terms_version', s.terms_version,
    'founder_bonus_pp', s.founder_bonus_pp,
    'founder_slots', s.founder_slots,
    'founder_slots_left', GREATEST(s.founder_slots - (SELECT count(*) FROM public.partner_profiles WHERE is_founder), 0),
    'levels', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'slug', l.slug, 'name', l.name, 'min_mrr', l.min_mrr,
        'min_active_clients', l.min_active_clients,
        'commission_percentage', l.commission_percentage,
        'benefits', l.benefits, 'color', l.color
      ) ORDER BY l.sort_order), '[]'::jsonb)
      FROM public.partner_levels l WHERE l.is_active
    ),
    'plans', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', p.name, 'price', p.price, 'duration', p.duration) ORDER BY p.price), '[]'::jsonb)
      FROM public.subscription_plans p WHERE p.is_active
    )
  )
  FROM public.partner_settings s
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_partner_program_public_info() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Commission trigger: notification wording for the 24h release
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_partner_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partner_uuid uuid;
  managed_user_name text;
  s partner_settings%ROWTYPE;
  v_profile partner_profiles%ROWTYPE;
  active_count integer;
  comm_pct numeric;
  v_multiplier numeric := 1;
  v_campaign_id uuid;
  commission_amount numeric;
  commission_type text;
  v_months integer;
  v_installments integer := 1;
  v_holding interval;
  v_first_id uuid;
  v_new_id uuid;
  v_inserted integer := 0;
  i integer;
  c record;
  v_count integer;
BEGIN
  IF NOT (
    NEW.status = 'active'
    AND (TG_OP = 'INSERT' OR OLD.next_payment_date IS DISTINCT FROM NEW.next_payment_date)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT managed_by_partner_id INTO partner_uuid FROM users WHERE id = NEW.user_id;
  IF partner_uuid IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO s FROM partner_settings LIMIT 1;
  IF NOT COALESCE(s.is_active, true) OR NOT COALESCE(s.renewal_commissions_enabled, true) THEN
    RETURN NEW;
  END IF;
  IF partner_uuid = NEW.user_id AND COALESCE(s.self_referral_block, true) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM partner_profiles WHERE user_id = partner_uuid;
  IF v_profile.status = 'terminated' THEN RETURN NEW; END IF;

  IF NEW.plan_price IS NULL OR NEW.plan_price <= 0 THEN RETURN NEW; END IF;

  commission_type := CASE WHEN TG_OP = 'INSERT' OR OLD.status = 'pending' OR OLD.status IS DISTINCT FROM 'active' AND NOT EXISTS (
    SELECT 1 FROM partner_commissions pc WHERE pc.subscription_id = NEW.id AND pc.type IN ('new', 'renewal')
  ) THEN 'new' ELSE 'renewal' END;

  PERFORM partner_recompute_level(partner_uuid);
  active_count := partner_active_user_count(partner_uuid);
  comm_pct := partner_effective_rate(partner_uuid);

  IF commission_type = 'new' THEN
    SELECT id, multiplier INTO v_campaign_id, v_multiplier FROM partner_campaigns
    WHERE kind = 'multiplier' AND is_active AND now() BETWEEN starts_at AND ends_at
    ORDER BY multiplier DESC LIMIT 1;
    v_multiplier := COALESCE(v_multiplier, 1);
  END IF;

  commission_amount := ROUND(NEW.plan_price * (comm_pct / 100.0) * v_multiplier, 2);
  IF commission_amount <= 0 THEN RETURN NEW; END IF;

  v_months := partner_cycle_months(NEW.billing_cycle::text);
  IF v_months >= 12 AND COALESCE(s.annual_installments, true) THEN
    v_installments := 12;
  END IF;
  v_holding := make_interval(days => COALESCE(s.holding_days, 30));

  FOR i IN 1..v_installments LOOP
    INSERT INTO partner_commissions (
      partner_id, managed_user_id, subscription_id, plan_name, plan_price,
      commission_percentage, amount, type, active_users_snapshot,
      next_payment_date_at_generation, status, available_at,
      installment_number, installment_total, billing_cycle, campaign_id
    )
    VALUES (
      partner_uuid, NEW.user_id, NEW.id, NEW.plan_name, NEW.plan_price,
      comm_pct,
      CASE WHEN v_installments = 1 THEN commission_amount
           WHEN i < v_installments THEN ROUND(commission_amount / v_installments, 2)
           ELSE commission_amount - ROUND(commission_amount / v_installments, 2) * (v_installments - 1) END,
      commission_type, active_count,
      NEW.next_payment_date::date, 'holding',
      now() + v_holding + make_interval(months => i - 1),
      i, v_installments, NEW.billing_cycle::text, v_campaign_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_new_id;
    IF v_new_id IS NOT NULL THEN
      v_inserted := v_inserted + 1;
      IF i = 1 THEN v_first_id := v_new_id; END IF;
    END IF;
    v_new_id := NULL;
  END LOOP;

  IF v_inserted = 0 THEN RETURN NEW; END IF;

  -- Recruiter override (partner-refers-partner, one level only).
  IF v_profile.recruited_by_partner_id IS NOT NULL
     AND v_profile.approved_at > now() - make_interval(months => COALESCE(s.recruit_override_months, 12))
     AND COALESCE(s.recruit_override_percentage, 0) > 0
     AND EXISTS (SELECT 1 FROM partner_profiles WHERE user_id = v_profile.recruited_by_partner_id AND status = 'approved') THEN
    INSERT INTO partner_commissions (
      partner_id, managed_user_id, subscription_id, plan_name, plan_price, commission_percentage,
      amount, type, next_payment_date_at_generation, status, available_at, source_commission_id, description
    ) VALUES (
      v_profile.recruited_by_partner_id, NEW.user_id, NEW.id, NEW.plan_name, NEW.plan_price, s.recruit_override_percentage,
      ROUND(commission_amount * s.recruit_override_percentage / 100.0, 2), 'override',
      NEW.next_payment_date::date, 'holding', now() + v_holding, v_first_id,
      'Bônus de indicação de parceiro'
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF commission_type = 'new' THEN
    UPDATE partner_profiles SET last_sale_at = now() WHERE user_id = partner_uuid;
    UPDATE partner_leads SET stage = 'won' WHERE converted_user_id = NEW.user_id AND partner_id = partner_uuid AND stage <> 'won';

    -- First-sale bonus within the first N days after approval.
    IF COALESCE(s.first_sale_bonus_amount, 0) > 0
       AND v_profile.approved_at > now() - make_interval(days => COALESCE(s.first_sale_bonus_days, 30)) THEN
      INSERT INTO partner_commissions (partner_id, managed_user_id, amount, type, status, available_at, description, source_commission_id)
      VALUES (partner_uuid, NEW.user_id, s.first_sale_bonus_amount, 'bonus', 'holding', now() + v_holding, 'first_sale', v_first_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Goal campaigns reached with this sale.
    FOR c IN
      SELECT * FROM partner_campaigns
      WHERE kind = 'goal' AND is_active AND now() BETWEEN starts_at AND ends_at
    LOOP
      SELECT COUNT(DISTINCT managed_user_id) INTO v_count FROM partner_commissions
      WHERE partner_id = partner_uuid AND type = 'new' AND created_at BETWEEN c.starts_at AND c.ends_at;
      IF v_count >= c.goal_new_clients THEN
        INSERT INTO partner_commissions (partner_id, amount, type, status, available_at, description, campaign_id)
        VALUES (partner_uuid, c.goal_bonus_amount, 'bonus', 'holding', now() + v_holding, 'Meta atingida: ' || c.name, c.id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(name, email, 'Um cliente') INTO managed_user_name FROM users WHERE id = NEW.user_id;
  INSERT INTO notifications (user_id, type, title, message, related_entity_id, related_entity_type)
  VALUES (
    partner_uuid,
    'partner_commission',
    CASE WHEN commission_type = 'new' THEN 'Nova comissão de parceiro!' ELSE 'Comissão de renovação!' END,
    managed_user_name || ' ' ||
      (CASE WHEN commission_type = 'new' THEN 'assinou' ELSE 'renovou' END) ||
      ' o plano ' || COALESCE(NEW.plan_name, '') ||
      ' — comissão de R$ ' || to_char(commission_amount, 'FM999G999G990D00') ||
      CASE WHEN v_installments > 1 THEN ' (em ' || v_installments || ' parcelas mensais)' ELSE '' END ||
      ', liberada para saque em ' ||
        CASE WHEN COALESCE(s.holding_days, 30) <= 1 THEN '24 horas.' ELSE COALESCE(s.holding_days, 30) || ' dias.' END,
    NEW.user_id,
    'partner_commission'
  );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('20261103160000', 'partners_commission_24h')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
