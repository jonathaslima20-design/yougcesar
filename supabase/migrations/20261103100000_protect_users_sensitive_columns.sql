/*
  # Protect sensitive columns on public.users from non-admin writes

  1. Problem
    - RLS is row-level only. Three policies let a non-admin write a users row:
        * "Users can insert own profile"   (INSERT, auth.uid() = id)
        * "Users can update own profile"   (UPDATE, auth.uid() = id)
        * "Partners can update managed users" (UPDATE, managed_by_partner_id = auth.uid())
      None of them restrict WHICH columns change, so through the REST API:
        * a partner could set a managed client's plan_status = 'active' (free
          paid plan), change its role, or move it to another partner;
        * any user could do the same to their own row (role = 'admin',
          plan_status = 'active', payments_test_override = true, ...);
        * a signup could INSERT its own row already as admin / active.
      20260723010000_create_partners_role.sql explicitly left this to the UI.

  2. Changes
    - BEFORE INSERT OR UPDATE trigger `a_protect_users_sensitive_columns`
      (the "a_" prefix makes it fire before trigger_set_plan_status_changed_at,
      so it sees the caller's own values, not the derived timestamp).
    - Bypassed entirely for service_role, SECURITY DEFINER functions and
      migrations (current_user is not 'authenticated'/'anon') and for admins.
      The trigger function itself is SECURITY INVOKER on purpose: as DEFINER,
      current_user would always be its owner and the check would never fire.
    - For everyone else:
        * INSERT (self-signup): role must be 'corretor'; plan_status only
          'free'/'inactive', or 'trial' with a referrer and <= 16-day trial;
          not blocked; admin-gated flags off; managed_by_partner_id only when
          it equals referred_by and that referrer is a partner.
        * UPDATE: admin/billing columns are immutable. Allowed exceptions,
          all matching existing client flows in src/lib/auth/simpleAuth.ts and
          src/pages/dashboard/CheckoutPage.tsx:
            - self may downgrade plan_status to 'expired'/'trial_expired';
            - self may sync subscription_end_date to their real active
              subscription's next_payment_date;
            - self may set referred_by once (was NULL), never to themselves;
            - a managing partner may block a client and lift only blocks
              they placed (tracked in the new users.blocked_by); self may not.
*/

-- Who placed the current block: NULL = admin/system, a partner id = that
-- partner (who is then the only non-admin allowed to lift it).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blocked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.protect_users_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  is_self boolean;
  referrer_role text;
  active_sub_end date;
  new_j jsonb;
  old_j jsonb;
  col text;
BEGIN
  -- Inside SECURITY DEFINER functions, service_role requests and migrations
  -- the effective role is not one of the PostgREST client roles.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    IF TG_OP = 'UPDATE' AND NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
      NEW.blocked_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.role, 'corretor') <> 'corretor' THEN
      RAISE EXCEPTION 'Not allowed to set role on signup' USING ERRCODE = '42501';
    END IF;

    new_j := to_jsonb(NEW);
    IF COALESCE(NEW.is_blocked, false)
       OR COALESCE((new_j ->> 'payments_test_override')::boolean, false)
       OR COALESCE((new_j ->> 'shipping_test_override')::boolean, false)
       OR COALESCE((new_j ->> 'insurance_enabled')::boolean, false)
       OR COALESCE((new_j ->> 'affiliate_program_enabled')::boolean, false)
       OR COALESCE((new_j ->> 'cashback_enabled')::boolean, false)
       OR COALESCE((new_j ->> 'max_images_per_product')::integer, 10) > 10 THEN
      RAISE EXCEPTION 'Not allowed to set admin-managed fields on signup' USING ERRCODE = '42501';
    END IF;

    IF NEW.referred_by IS NOT NULL AND NEW.referred_by = NEW.id THEN
      RAISE EXCEPTION 'Self-referral is not allowed' USING ERRCODE = '42501';
    END IF;

    IF NEW.referred_by IS NOT NULL THEN
      SELECT role INTO referrer_role FROM public.users WHERE id = NEW.referred_by;
    END IF;

    IF NEW.managed_by_partner_id IS NOT NULL
       AND (NEW.managed_by_partner_id IS DISTINCT FROM NEW.referred_by OR referrer_role IS DISTINCT FROM 'partner') THEN
      RAISE EXCEPTION 'Invalid managing partner on signup' USING ERRCODE = '42501';
    END IF;

    IF NEW.plan_status = 'trial' THEN
      IF NEW.referred_by IS NULL OR referrer_role IS NULL
         OR NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > now() + interval '16 days' THEN
        RAISE EXCEPTION 'Trial is only granted through a valid referral link' USING ERRCODE = '42501';
      END IF;
    ELSIF COALESCE(NEW.plan_status, 'free') NOT IN ('free', 'inactive') THEN
      RAISE EXCEPTION 'Not allowed to set plan_status on signup' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE
  is_self := caller IS NOT NULL AND caller = OLD.id;

  -- Compared through jsonb so a column that only exists in some environments
  -- (several came from the pre-migrations Bolt schema) reads as NULL on both
  -- sides instead of breaking every UPDATE on users.
  new_j := to_jsonb(NEW);
  old_j := to_jsonb(OLD);
  FOREACH col IN ARRAY ARRAY[
    'role', 'managed_by_partner_id', 'created_by', 'trial_ends_at', 'next_payment_date',
    'billing_cycle', 'subscription_plan_name', 'plan_status_changed_at',
    'payments_test_override', 'shipping_test_override', 'insurance_enabled',
    'affiliate_program_enabled', 'cashback_enabled', 'max_images_per_product', 'listing_limit'
  ] LOOP
    IF new_j -> col IS DISTINCT FROM old_j -> col THEN
      RAISE EXCEPTION 'Not allowed to change admin-managed fields (%)', col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status
     AND NOT (is_self AND NEW.plan_status IN ('expired', 'trial_expired')) THEN
    RAISE EXCEPTION 'Not allowed to change plan_status' USING ERRCODE = '42501';
  END IF;

  IF NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date THEN
    IF NOT is_self THEN
      RAISE EXCEPTION 'Not allowed to change subscription_end_date' USING ERRCODE = '42501';
    END IF;
    SELECT next_payment_date::date INTO active_sub_end
    FROM public.subscriptions
    WHERE user_id = OLD.id AND status = 'active'
    ORDER BY next_payment_date DESC
    LIMIT 1;
    IF active_sub_end IS NULL OR NEW.subscription_end_date::date IS DISTINCT FROM active_sub_end THEN
      RAISE EXCEPTION 'subscription_end_date must match the active subscription' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    IF NOT is_self OR OLD.referred_by IS NOT NULL OR NEW.referred_by IS NULL OR NEW.referred_by = OLD.id THEN
      RAISE EXCEPTION 'Not allowed to change referred_by' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code AND NOT is_self THEN
    RAISE EXCEPTION 'Not allowed to change referral_code' USING ERRCODE = '42501';
  END IF;

  IF NEW.blocked_by IS DISTINCT FROM OLD.blocked_by AND NEW.is_blocked IS NOT DISTINCT FROM OLD.is_blocked THEN
    RAISE EXCEPTION 'Not allowed to change blocked_by' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
    IF is_self OR NOT public.is_partner() OR OLD.managed_by_partner_id IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'Not allowed to change is_blocked' USING ERRCODE = '42501';
    END IF;
    -- A partner can only lift a block they placed themselves, never one set
    -- by an admin (e.g. "pendência financeira").
    IF NOT NEW.is_blocked AND OLD.blocked_by IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'This account was blocked by VitrineTurbo support' USING ERRCODE = '42501';
    END IF;
    NEW.blocked_by := CASE WHEN NEW.is_blocked THEN caller ELSE NULL END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_protect_users_sensitive_columns ON public.users;
CREATE TRIGGER a_protect_users_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_users_sensitive_columns();
