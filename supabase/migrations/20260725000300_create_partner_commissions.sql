/*
  # Create partner_commissions

  1. Problem
    - The Partners program needs a ledger of every commission earned by a
      partner when a managed user's subscription activates or renews,
      shaped like the existing `referral_commissions` table (a separate,
      unrelated corretor money-referral program — see
      supabase/migrations/20260723010000_create_partners_role.sql) but with
      audit fields the older table lacks, since this program pays out
      recurring/tiered amounts rather than a one-time fixed fee.

  2. Changes
    - `partner_commissions`: one row per commission event. `type`
      distinguishes a brand new subscription from a renewal. `plan_price`
      and `commission_percentage` are captured at generation time (not
      looked up later) so historical rows stay accurate even if tiers or
      plan prices change afterwards. `active_users_snapshot` records how
      many active managed users the partner had at that moment, so a
      "why was this 50% and not 30%" dispute can be answered without
      reverse-engineering historical tier config.
    - `UNIQUE (subscription_id, next_payment_date_at_generation)`: makes the
      trigger that inserts these rows idempotent — a webhook retry or a
      duplicate trigger fire for the same renewal cycle can never create a
      second commission for it.
    - RLS: a partner can see only their own commissions; admins see all.
      Only admins may UPDATE/DELETE (e.g. marking paid/reversed) — rows are
      otherwise inserted exclusively by the SECURITY DEFINER trigger added
      in a later migration, which bypasses RLS.
*/

CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  managed_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id uuid,
  plan_name text,
  plan_price numeric NOT NULL,
  commission_percentage numeric NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('new', 'renewal')),
  active_users_snapshot integer NOT NULL DEFAULT 0,
  next_payment_date_at_generation date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  reversed_at timestamptz,
  UNIQUE (subscription_id, next_payment_date_at_generation)
);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON public.partner_commissions (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_managed_user_id ON public.partner_commissions (managed_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON public.partner_commissions (status);

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own commissions" ON public.partner_commissions;
CREATE POLICY "Partners can view own commissions"
  ON public.partner_commissions FOR SELECT
  TO authenticated
  USING (partner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update commissions" ON public.partner_commissions;
CREATE POLICY "Admins can update commissions"
  ON public.partner_commissions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete commissions" ON public.partner_commissions;
CREATE POLICY "Admins can delete commissions"
  ON public.partner_commissions FOR DELETE
  TO authenticated
  USING (public.is_admin());
