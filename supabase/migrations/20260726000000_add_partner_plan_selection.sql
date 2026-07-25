/*
  # Partner-assigned plan selection at signup: schema + trigger fix

  1. Problem
    - Partners want to assign a paid plan when creating a merchant account,
      granting immediate access (`plan_status = 'active'`) while payment is
      still pending, with a configurable grace window (in hours) before the
      account is automatically blocked like any other overdue subscription.
    - The existing day-only expiry machinery
      (supabase/functions/check-expiring-subscriptions/index.ts) only ever
      compares `YYYY-MM-DD` strings — no existing column has hour
      resolution, and a 6-hour default deadline needs it.
    - Introducing a `pending` subscription row for this flow exposes a
      latent bug in generate_partner_commission() (
      supabase/migrations/20260725000500_create_partner_commission_trigger.sql):
      its type ('new' vs 'renewal') is decided by TG_OP, but the first-ever
      payment for this new flow arrives as an UPDATE (the pending row
      already exists), which would mislabel it as a renewal.

  2. Changes
    - `subscriptions.payment_due_at`: timestamptz, NULL everywhere except
      this new partner-assigned-pending flow — doubles as the discriminator
      the new cron (added in a follow-up migration) filters on, no separate
      "source" column needed.
    - `partner_settings.payment_deadline_hours`: admin-configurable, default 6.
    - `generate_partner_commission()`: commission type now keys off whether
      the row had a prior `next_payment_date` (true first payment) rather
      than TG_OP, so a partner-assigned pending subscription's first real
      payment is correctly recorded as 'new', not 'renewal'.
*/

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_due_at timestamptz;

ALTER TABLE public.partner_settings ADD COLUMN IF NOT EXISTS payment_deadline_hours integer NOT NULL DEFAULT 6;

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
  commission_type := CASE WHEN TG_OP = 'INSERT' OR OLD.next_payment_date IS NULL THEN 'new' ELSE 'renewal' END;

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
