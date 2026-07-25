/*
  # Create partner_settings

  1. Problem
    - The Partners commission engine needs a single place for admin-tunable
      knobs: a program-wide kill switch, whether renewal commissions are
      currently being generated, the minimum withdrawal amount, and a grace
      period so a partner's tier doesn't flap the moment a managed user's
      payment is a day late.

  2. Changes
    - `partner_settings`: singleton table (mirrors the existing
      `referral_settings` singleton pattern used by the corretor referral
      program). Seeded with one row of defaults.
    - RLS: SELECT for any authenticated user (the partner dashboard reads
      `minimum_withdrawal_amount`/`is_active`), writes restricted to admins.
*/

CREATE TABLE IF NOT EXISTS public.partner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  renewal_commissions_enabled boolean NOT NULL DEFAULT true,
  minimum_withdrawal_amount numeric NOT NULL DEFAULT 50.00,
  grace_period_days integer NOT NULL DEFAULT 7,
  self_referral_block boolean NOT NULL DEFAULT true,
  share_message_whatsapp text DEFAULT '',
  share_message_telegram text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.partner_settings (is_active, renewal_commissions_enabled, minimum_withdrawal_amount, grace_period_days, self_referral_block)
SELECT true, true, 50.00, 7, true
WHERE NOT EXISTS (SELECT 1 FROM public.partner_settings);

ALTER TABLE public.partner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view partner settings" ON public.partner_settings;
CREATE POLICY "Authenticated users can view partner settings"
  ON public.partner_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage partner settings" ON public.partner_settings;
CREATE POLICY "Admins can manage partner settings"
  ON public.partner_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
