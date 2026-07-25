/*
  # Fix new-vs-renewal detection in generate_partner_commission

  1. Problem
    - `subscriptions.next_payment_date` is NOT NULL (discovered when the
      partner-assigned-plan insert in supabase/functions/create-user tried
      to leave it null and failed the constraint). The previous fix in
      supabase/migrations/20260726000000_add_partner_plan_selection.sql
      used `OLD.next_payment_date IS NULL` to detect a partner-assigned
      pending subscription's first real payment — but since that column can
      never actually be null, that check would never be true, silently
      reintroducing the exact "first payment misclassified as renewal" bug
      it was meant to fix.
    - `create-user` now populates `next_payment_date` with the payment
      deadline date on insert (a real, non-null placeholder), which makes
      this nullness check moot regardless.

  2. Changes
    - `commission_type` now keys off `OLD.status = 'pending'` instead: a
      partner-assigned subscription is inserted with status='pending' and
      only reaches 'active' when mp-webhook processes the actual first
      payment (an UPDATE from pending -> active) — a genuine renewal always
      updates a row that was already 'active'. Also covers the ordinary
      (non-partner) INSERT-active first-payment case via TG_OP = 'INSERT'.
*/

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
  commission_type := CASE WHEN TG_OP = 'INSERT' OR OLD.status = 'pending' THEN 'new' ELSE 'renewal' END;

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
