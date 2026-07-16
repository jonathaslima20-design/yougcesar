/*
  # Support the Mensal plan in referral commissions

  1. Problem
    - generate_referral_commission() only recognizes quarterly/semiannually/annually
      billing cycles. With Trimestral being retired in favor of a new Mensal plan,
      referrals on the Mensal plan would either fall through to a wrong fallback
      price (fixed-mode: 0 commission) or an incorrect estimated price
      (percentage-mode fallback, only used if the plan lookup by name fails).

  2. Changes
    - Adds a commission_mensal column to referral_settings (fixed-mode amount for
      the Mensal plan), defaulting to 17.10 (30% of R$ 57 — the retired Trimestral's
      R$ 50.00 would exceed what the platform collects after the referred user's 20%
      discount, at R$ 57 * 0.8 = R$ 45.60).
    - Updates generate_referral_commission() to recognize billing = 'monthly' /
      plan_name ILIKE '%mensal%' in both percentage-mode (fallback estimated price)
      and fixed-mode (commission_mensal setting).
    - The R$ 44.70 minimum floor in percentage-mode was calibrated to exactly match
      30% of the old Trimestral price (R$ 149) and never actually applied to
      Semestral/Anual (both already exceed it). Applying it to the Mensal plan would
      make the "30% commission" promise pay out ~2.6x the real 30% (R$ 44.70 vs the
      correct R$ 17.10), leaving the platform almost nothing after the referred
      user's discount. The floor is now skipped for the monthly billing cycle.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_settings' AND column_name = 'commission_mensal') THEN
    ALTER TABLE public.referral_settings ADD COLUMN commission_mensal numeric NOT NULL DEFAULT 17.10;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION generate_referral_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_uuid uuid;
  referred_user_name text;
  commission_amount numeric;
  settings_row record;
  billing text;
  plan_price numeric;
  comm_pct numeric;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN

    SELECT referred_by INTO referrer_uuid
    FROM public.users
    WHERE id = NEW.user_id;

    IF referrer_uuid IS NOT NULL THEN

      -- Get all commission settings
      SELECT
        commission_type, commission_percentage,
        commission_mensal, commission_trimestral, commission_semestral, commission_anual
      INTO settings_row
      FROM public.referral_settings
      LIMIT 1;

      billing := LOWER(COALESCE(NEW.billing_cycle::text, ''));

      IF COALESCE(settings_row.commission_type, 'percentage') = 'percentage' THEN
        -- Percentage mode: calculate from plan price
        comm_pct := COALESCE(settings_row.commission_percentage, 30);

        -- Look up plan price by name only (plan_id column does not exist on subscriptions)
        SELECT price INTO plan_price
        FROM public.subscription_plans
        WHERE LOWER(name) = LOWER(NEW.plan_name)
        LIMIT 1;

        -- Fallback: estimate price from billing cycle
        IF plan_price IS NULL THEN
          IF billing = 'monthly' OR LOWER(NEW.plan_name) LIKE '%mensal%' THEN
            plan_price := 57.00;
          ELSIF billing = 'quarterly' OR LOWER(NEW.plan_name) LIKE '%trimestral%' THEN
            plan_price := 149.00;
          ELSIF billing = 'semiannually' OR LOWER(NEW.plan_name) LIKE '%semestral%' THEN
            plan_price := 229.00;
          ELSIF billing = 'annually' OR LOWER(NEW.plan_name) LIKE '%anual%' THEN
            plan_price := 336.00;
          ELSE
            plan_price := 149.00;
          END IF;
        END IF;

        commission_amount := ROUND(plan_price * (comm_pct / 100.0), 2);
        -- Apply minimum floor of R$ 44.70 (calibrated for the old Trimestral price;
        -- does not apply to the Mensal plan, where it would exceed the real 30%)
        IF billing != 'monthly' AND commission_amount < 44.70 THEN
          commission_amount := 44.70;
        END IF;

      ELSE
        -- Fixed mode: use fixed amounts from settings
        comm_pct := NULL;
        plan_price := NULL;

        IF billing = 'monthly' OR LOWER(NEW.plan_name) LIKE '%mensal%' THEN
          commission_amount := COALESCE(settings_row.commission_mensal, 17.10);
        ELSIF billing = 'quarterly' OR LOWER(NEW.plan_name) LIKE '%trimestral%' THEN
          commission_amount := COALESCE(settings_row.commission_trimestral, 50.00);
        ELSIF billing = 'semiannually' OR LOWER(NEW.plan_name) LIKE '%semestral%' THEN
          commission_amount := COALESCE(settings_row.commission_semestral, 70.00);
        ELSIF billing = 'annually' OR LOWER(NEW.plan_name) LIKE '%anual%' THEN
          commission_amount := COALESCE(settings_row.commission_anual, 100.00);
        ELSE
          commission_amount := 0.00;
        END IF;
      END IF;

      IF commission_amount > 0 THEN
        -- Insert commission record
        INSERT INTO public.referral_commissions (
          referrer_id,
          referred_user_id,
          subscription_id,
          plan_type,
          amount,
          status,
          original_plan_value,
          commission_percentage
        )
        VALUES (
          referrer_uuid,
          NEW.user_id,
          NEW.id,
          NEW.plan_name,
          commission_amount,
          'pending',
          plan_price,
          comm_pct
        );

        -- Get referred user name for notification
        SELECT COALESCE(name, email, 'Um usuario') INTO referred_user_name
        FROM public.users
        WHERE id = NEW.user_id;

        -- Create notification for the referrer
        INSERT INTO public.notifications (
          user_id,
          type,
          title,
          message,
          related_entity_id,
          related_entity_type
        )
        VALUES (
          referrer_uuid,
          'referral_upgrade',
          'Indicado fez upgrade!',
          referred_user_name || ' ativou o plano ' || NEW.plan_name || ' — voce ganhou R$ ' || commission_amount::text || ' de comissao!',
          NEW.user_id,
          'referral'
        );
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;
