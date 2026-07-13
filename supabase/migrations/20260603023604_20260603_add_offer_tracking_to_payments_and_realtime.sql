/*
  # Track offer-driven payments and enable realtime for offers

  1. Changes to existing tables
    - `mp_payments`
      - Add `offer_id` (uuid, FK -> promotional_offers, nullable) so we can attribute a payment to a promotional offer.
      - Add `coupon_id` (uuid, nullable) to record an auto-applied coupon when the offer carries one.
      - Add `discount_cents` (integer, default 0) to store the absolute discount value applied at checkout.
    - `offer_user_assignments`
      - Add `converted_at` (timestamptz, nullable) to mark when a payment-derived conversion happened.

  2. Realtime
    - Add `promotional_offers`, `offer_user_assignments` and `offer_impressions` to the
      `supabase_realtime` publication so the user dashboard can react to admin changes
      (including the manual real-time send broadcast usage).

  3. Notes
    - All changes are additive: existing data is preserved, no destructive operations.
    - RLS is left as-is since the new columns are server-side-managed and existing
      policies already restrict reads to the owning user / admins.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mp_payments' AND column_name = 'offer_id'
  ) THEN
    ALTER TABLE public.mp_payments
      ADD COLUMN offer_id uuid REFERENCES public.promotional_offers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mp_payments' AND column_name = 'coupon_id'
  ) THEN
    ALTER TABLE public.mp_payments ADD COLUMN coupon_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mp_payments' AND column_name = 'discount_cents'
  ) THEN
    ALTER TABLE public.mp_payments ADD COLUMN discount_cents integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'offer_user_assignments' AND column_name = 'converted_at'
  ) THEN
    ALTER TABLE public.offer_user_assignments ADD COLUMN converted_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mp_payments_offer_id ON public.mp_payments(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_assignments_converted_at ON public.offer_user_assignments(converted_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'promotional_offers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.promotional_offers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'offer_user_assignments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.offer_user_assignments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'offer_impressions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.offer_impressions';
  END IF;
END $$;
