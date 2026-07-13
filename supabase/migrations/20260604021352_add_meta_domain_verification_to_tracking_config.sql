/*
  # Add Meta Domain Verification field

  ## Summary
  Adds a field to store the Meta domain verification code that gets injected
  as a <meta name="facebook-domain-verification" content="..." /> tag in the
  landing page <head>.

  ## Modified Tables
  - `landing_tracking_config`
    - `meta_domain_verification` (text) - The verification code from Meta Business Suite

  ## Notes
  - Value is the content attribute only (e.g. "abcdef123456"), not the full HTML tag
  - Injected in the landing page head when non-empty
  - Admin-only write access enforced by existing RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'meta_domain_verification'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN meta_domain_verification text NOT NULL DEFAULT '';
  END IF;
END $$;
