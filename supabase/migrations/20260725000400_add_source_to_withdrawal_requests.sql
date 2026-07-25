/*
  # Add source discriminator to withdrawal_requests

  1. Problem
    - `withdrawal_requests` (predates this repo's tracked migration history
      — only ever ALTERed, e.g. in
      supabase/migrations/20260527200726_fix_user_deletion_fk_constraints.sql)
      is implicitly referral-program-only: no column says which program a
      withdrawal belongs to. The Partners program is being wired to reuse
      this same table + its existing PIX/withdrawal UI rather than building
      a parallel payout system, so a discriminator is needed to tell partner
      payout requests apart from corretor referral payout requests.

  2. Changes
    - `withdrawal_requests.source`: text, defaults to 'referral' so every
      existing row is correctly classified with no data backfill needed.
*/

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'referral';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_source_check'
  ) THEN
    ALTER TABLE public.withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_source_check CHECK (source IN ('referral', 'partner'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_source ON public.withdrawal_requests (source);
