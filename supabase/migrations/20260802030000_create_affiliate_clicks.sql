/*
  # Create affiliate_clicks

  1. Problem
    - The affiliate dashboard needs click/visit metrics for each affiliate's
      catalog link (`?aff=CODE`), and the checkout flow needs a record it can
      cross-reference for auditing which click led to which order. There is
      no existing first-party visit-tracking table in this project (tracking
      today is third-party pixels only, see src/lib/tracking.ts) — the
      closest structural precedent is `referral_clicks`
      (20260531155046_create_referral_clicks_and_update_settings.sql), an
      unrelated SaaS-signup-referral click log with the same insert-only,
      soft-dedup shape.

  2. New Tables
    - `affiliate_clicks`
      - `id` (uuid, PK)
      - `affiliate_id` (uuid, FK -> affiliates.id, ON DELETE CASCADE)
      - `visitor_id` (uuid) - client-generated (crypto.randomUUID()), cached
        in sessionStorage by the storefront, same soft-fingerprint approach
        as referral_clicks.visitor_id — not a durable/tamper-proof dedup, just
        enough to eyeball unique-visitor counts in the affiliate dashboard.
      - `landing_path` (text) - which page the click landed on (store home vs
        a specific product), for basic funnel insight.
      - `created_at` (timestamptz)

  3. Security
    - INSERT open to anon + authenticated (`WITH CHECK (true)`) — any visitor,
      logged in or not, can trigger a click record just by loading the page
      with `?aff=CODE`.
    - SELECT restricted to the affiliate themselves and the owning store
      (via a join back to affiliates.store_owner_id). No public SELECT.
*/

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  visitor_id uuid,
  landing_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_id_created_at
  ON public.affiliate_clicks (affiliate_id, created_at DESC);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record an affiliate click" ON public.affiliate_clicks;
CREATE POLICY "Anyone can record an affiliate click"
  ON public.affiliate_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Affiliates can view own clicks" ON public.affiliate_clicks;
CREATE POLICY "Affiliates can view own clicks"
  ON public.affiliate_clicks FOR SELECT
  TO authenticated
  USING (affiliate_id = auth.uid());

DROP POLICY IF EXISTS "Store owners can view own affiliates clicks" ON public.affiliate_clicks;
CREATE POLICY "Store owners can view own affiliates clicks"
  ON public.affiliate_clicks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = affiliate_clicks.affiliate_id AND a.store_owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can view all affiliate clicks" ON public.affiliate_clicks;
CREATE POLICY "Admins can view all affiliate clicks"
  ON public.affiliate_clicks FOR SELECT
  TO authenticated
  USING (public.is_admin());
