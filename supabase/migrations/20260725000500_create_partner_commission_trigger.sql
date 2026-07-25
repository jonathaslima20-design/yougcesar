/*
  # Partner commission engine: generate_partner_commission trigger

  1. Problem
    - Need to generate a `partner_commissions` row whenever a managed user's
      subscription activates for the first time OR renews, applying the
      partner's current tiered commission percentage.
    - The analogous, older `generate_referral_commission()` trigger
      (supabase/migrations/20260716020100_add_monthly_referral_commission_support.sql)
      only fires on `NEW.status = 'active' AND OLD.status != 'active'`. But
      supabase/functions/mp-webhook/index.ts's `activatePlan()` re-sets
      `status = 'active'` on every renewal too, without ever transitioning
      through another status in between — so that condition is only ever
      true once, at first activation, and silently never fires again on
      renewals. This trigger deliberately uses a different condition to
      avoid repeating that bug: it also fires whenever `next_payment_date`
      changes, which the existing `trigger_sync_subscription_dates` trigger
      (supabase/migrations/20260604200049_sync_subscription_dates_trigger_and_reconciliation.sql)
      already relies on being bumped on every renewal.

  2. Changes
    - `public.partner_active_user_count(p_partner_id uuid)`: counts a
      partner's active managed users (plan_status = 'active', or lapsed
      within the configured grace period). SECURITY DEFINER so it can be
      called both from the trigger and directly from the frontend via RPC,
      keeping the two counts from ever drifting apart.
    - `public.generate_partner_commission()` + trigger on `subscriptions`
      (AFTER INSERT OR UPDATE): resolves the managing partner via
      `users.managed_by_partner_id` (NOT `referred_by`, which belongs to
      the separate corretor referral program), checks the admin kill switch
      in `partner_settings`, blocks self-referral, looks up the applicable
      tier from `partner_commission_tiers`, and inserts a
      `partner_commissions` row using `subscriptions.plan_price` directly
      (no fragile plan-name lookup) plus a notification for the partner.
*/

CREATE OR REPLACE FUNCTION public.partner_active_user_count(p_partner_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.users u
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT grace_period_days FROM public.partner_settings LIMIT 1),
      7
    ) AS grace_days
  ) s
  WHERE u.managed_by_partner_id = p_partner_id
    AND (
      u.plan_status = 'active'
      OR (
        u.plan_status IN ('expired', 'suspended')
        AND u.plan_status_changed_at >= now() - (s.grace_days || ' days')::interval
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.generate_partner_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  partner_uuid uuid;
  managed_user_name text;
  settings_row record;
  active_count integer;
  comm_pct numeric;
  commission_amount numeric;
  commission_type text;
BEGIN
  IF NOT (
    NEW.status = 'active'
    AND (TG_OP = 'INSERT' OR OLD.next_payment_date IS DISTINCT FROM NEW.next_payment_date)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT managed_by_partner_id INTO partner_uuid
  FROM public.users
  WHERE id = NEW.user_id;

  IF partner_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO settings_row FROM public.partner_settings LIMIT 1;
  IF NOT COALESCE(settings_row.is_active, true) OR NOT COALESCE(settings_row.renewal_commissions_enabled, true) THEN
    RETURN NEW;
  END IF;

  IF partner_uuid = NEW.user_id AND COALESCE(settings_row.self_referral_block, true) THEN
    RETURN NEW;
  END IF;

  active_count := public.partner_active_user_count(partner_uuid);

  SELECT commission_percentage INTO comm_pct
  FROM public.partner_commission_tiers
  WHERE is_active = true AND min_active_users <= active_count
  ORDER BY min_active_users DESC
  LIMIT 1;

  IF comm_pct IS NULL OR NEW.plan_price IS NULL THEN
    RETURN NEW;
  END IF;

  commission_amount := ROUND(NEW.plan_price * (comm_pct / 100.0), 2);
  commission_type := CASE WHEN TG_OP = 'INSERT' THEN 'new' ELSE 'renewal' END;

  IF commission_amount > 0 THEN
    INSERT INTO public.partner_commissions (
      partner_id, managed_user_id, subscription_id, plan_name, plan_price,
      commission_percentage, amount, type, active_users_snapshot,
      next_payment_date_at_generation, status
    )
    VALUES (
      partner_uuid, NEW.user_id, NEW.id, NEW.plan_name, NEW.plan_price,
      comm_pct, commission_amount, commission_type, active_count,
      NEW.next_payment_date::date, 'pending'
    )
    ON CONFLICT (subscription_id, next_payment_date_at_generation) DO NOTHING;

    SELECT COALESCE(name, email, 'Um usuário') INTO managed_user_name
    FROM public.users WHERE id = NEW.user_id;

    INSERT INTO public.notifications (
      user_id, type, title, message, related_entity_id, related_entity_type
    )
    VALUES (
      partner_uuid,
      'partner_commission',
      CASE WHEN commission_type = 'new' THEN 'Nova comissão de parceiro!' ELSE 'Comissão de renovação!' END,
      managed_user_name || ' ' ||
        (CASE WHEN commission_type = 'new' THEN 'assinou' ELSE 'renovou' END) ||
        ' o plano ' || COALESCE(NEW.plan_name, '') ||
        ' — você ganhou R$ ' || commission_amount::text || ' de comissão!',
      NEW.user_id,
      'partner_commission'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_partner_commission ON public.subscriptions;
CREATE TRIGGER trigger_generate_partner_commission
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_partner_commission();
