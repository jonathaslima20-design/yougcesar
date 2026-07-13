/*
  # Extend legal acceptance fields on public.users

  ## Summary
  Adds the two remaining legal-acceptance columns to `public.users` and sets
  sensible DEFAULT values on the previously-added version columns.

  ## Changes

  ### New columns
  - `cookies_preferences` (jsonb, nullable)
      Stores the user's granular cookie consent choices as a JSON object,
      e.g. {"necessary":true,"analytics":false,"functional":true,"marketing":false}.
      Kept as jsonb so it can be queried and evolved without schema changes.

  - `cookies_preferences_updated_at` (timestamptz, nullable)
      Records when `cookies_preferences` was last written, for audit and
      re-consent-expiry logic.

  ### Default values added to existing columns
  - `terms_version`            → DEFAULT '1.0'
  - `privacy_policy_version`   → DEFAULT '1.0'
      These columns were added in a prior migration without defaults. Setting a
      default now means future INSERT statements that omit the column receive
      the current version string automatically.

  ## Notes
  - All changes use IF NOT EXISTS / conditional blocks — safe to re-run.
  - No data is removed or modified; existing rows are untouched.
  - No RLS policies are added or altered; the columns inherit the table's
    existing row-level security.
  - No indexes are created: these fields are not expected to be used in
    high-cardinality WHERE clauses on their own.
*/

-- Add cookies_preferences column (jsonb) if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'cookies_preferences'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN cookies_preferences jsonb;

    COMMENT ON COLUMN public.users.cookies_preferences IS
      'Granular cookie consent choices recorded at banner interaction, '
      'e.g. {"necessary":true,"analytics":false,"functional":true,"marketing":false}';
  END IF;
END $$;

-- Add cookies_preferences_updated_at column if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'cookies_preferences_updated_at'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN cookies_preferences_updated_at timestamptz;

    COMMENT ON COLUMN public.users.cookies_preferences_updated_at IS
      'Timestamp of the most recent update to cookies_preferences; '
      'used to trigger re-consent flows after a defined expiry period.';
  END IF;
END $$;

-- Set DEFAULT '1.0' on terms_version (idempotent — ALTER COLUMN SET DEFAULT is always safe)
ALTER TABLE public.users
  ALTER COLUMN terms_version SET DEFAULT '1.0';

COMMENT ON COLUMN public.users.terms_version IS
  'Version string of the Terms of Use accepted by the user at registration, '
  'e.g. "1.0" or "2026-05-28". Defaults to ''1.0''.';

-- Set DEFAULT '1.0' on privacy_policy_version
ALTER TABLE public.users
  ALTER COLUMN privacy_policy_version SET DEFAULT '1.0';

COMMENT ON COLUMN public.users.privacy_policy_version IS
  'Version string of the Privacy Policy accepted by the user at registration, '
  'e.g. "1.0" or "2026-05-28". Defaults to ''1.0''.';

-- Annotate the previously-added timestamp columns for completeness
COMMENT ON COLUMN public.users.accepted_terms_at IS
  'Timestamp (UTC) at which the user explicitly accepted the Terms of Use.';

COMMENT ON COLUMN public.users.accepted_privacy_policy_at IS
  'Timestamp (UTC) at which the user explicitly accepted the Privacy Policy.';
