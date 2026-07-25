/*
  # Create partner_commission_tiers

  1. Problem
    - The VitrineTurbo Partners program needs a configurable recurring
      commission rate that increases as a partner brings in more active
      managed users (e.g. 30% recurring by default, 50% once a partner has
      20+ active managed users). Hardcoding these numbers into the trigger
      would require a migration every time the business wants to tweak the
      ladder.

  2. Changes
    - `partner_commission_tiers`: admin-editable rate ladder. Each row is a
      threshold — "once you have at least `min_active_users` active managed
      users, your rate is `commission_percentage`". The applicable tier for
      a given count is the row with the highest `min_active_users` that is
      still `<= count`.
    - Seeded with the two tiers from the product spec: 0 -> 30%, 20 -> 50%.
    - RLS: any authenticated user can SELECT (the partner dashboard needs to
      read this to render "progress to next tier" client-side), but only
      admins can write, via the existing `public.is_admin()` helper
      (supabase/migrations/20260716181000_fix_recursive_users_rls_policies.sql).
*/

CREATE TABLE IF NOT EXISTS public.partner_commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_active_users integer NOT NULL UNIQUE,
  commission_percentage numeric NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_commission_tiers_min_active_users
  ON public.partner_commission_tiers (min_active_users DESC);

INSERT INTO public.partner_commission_tiers (min_active_users, commission_percentage, label)
SELECT 0, 30, 'Padrão'
WHERE NOT EXISTS (SELECT 1 FROM public.partner_commission_tiers WHERE min_active_users = 0);

INSERT INTO public.partner_commission_tiers (min_active_users, commission_percentage, label)
SELECT 20, 50, 'Elite'
WHERE NOT EXISTS (SELECT 1 FROM public.partner_commission_tiers WHERE min_active_users = 20);

ALTER TABLE public.partner_commission_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view commission tiers" ON public.partner_commission_tiers;
CREATE POLICY "Authenticated users can view commission tiers"
  ON public.partner_commission_tiers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage commission tiers" ON public.partner_commission_tiers;
CREATE POLICY "Admins can manage commission tiers"
  ON public.partner_commission_tiers FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
