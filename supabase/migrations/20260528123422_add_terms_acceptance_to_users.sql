/*
  # Add legal terms acceptance fields to public.users

  ## Summary
  Adds four nullable columns to the `public.users` table to record when and which
  version of the Terms of Use and Privacy Policy each user accepted at registration.

  ## New Columns
  - `accepted_terms_at` (timestamptz, nullable) — timestamp of acceptance of the Terms of Use
  - `accepted_privacy_policy_at` (timestamptz, nullable) — timestamp of acceptance of the Privacy Policy
  - `terms_version` (text, nullable) — version string of the Terms of Use accepted (e.g. "2026-05-28")
  - `privacy_policy_version` (text, nullable) — version string of the Privacy Policy accepted

  ## Notes
  - All columns are nullable so existing rows are unaffected (no data loss).
  - No RLS changes needed; these columns follow the existing row-level security
    of the `users` table.
  - Existing rows will have NULL in these columns, which correctly reflects that
    they registered before explicit acceptance was required.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'accepted_terms_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN accepted_terms_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'accepted_privacy_policy_at'
  ) THEN
    ALTER TABLE public.users ADD COLUMN accepted_privacy_policy_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'terms_version'
  ) THEN
    ALTER TABLE public.users ADD COLUMN terms_version text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'privacy_policy_version'
  ) THEN
    ALTER TABLE public.users ADD COLUMN privacy_policy_version text;
  END IF;
END $$;
