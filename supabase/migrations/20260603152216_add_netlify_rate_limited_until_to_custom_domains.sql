/*
  # Add Netlify rate limit tracking to custom_domains

  ## Summary
  Adds a nullable timestamp column to track when a user's Netlify alias change
  quota resets. Netlify allows at most 3 alias changes per hour on some plans.

  ## Changes
  - `custom_domains.netlify_rate_limited_until` (timestamptz, nullable)
    Stores the UTC timestamp after which the user may attempt another domain
    alias change. NULL means no active rate limit.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_domains' AND column_name = 'netlify_rate_limited_until'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN netlify_rate_limited_until timestamptz DEFAULT NULL;
  END IF;
END $$;
