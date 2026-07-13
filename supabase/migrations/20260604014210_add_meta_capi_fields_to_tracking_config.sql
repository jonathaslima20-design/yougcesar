/*
  # Add Meta Pixel and Conversions API (CAPI) settings

  ## Summary
  Extends the landing_tracking_config table with fields required for
  Meta Pixel browser-side tracking and the Meta Conversions API (server-side).

  ## Modified Tables
  - `landing_tracking_config`
    - `meta_capi_token` (text) - Access token for Meta CAPI (server-side only)
    - `meta_capi_enabled` (boolean) - Whether CAPI server-side events are active
    - `meta_pixel_enabled` (boolean) - Whether browser-side pixel is active
    - `meta_test_event_code` (text) - Optional TEST_EVENT_CODE for testing in Events Manager

  ## Notes
  - Token stored in DB; only server-side edge function reads it
  - Frontend never exposes the CAPI token
  - Admin-only write access enforced by existing RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'meta_capi_token'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN meta_capi_token text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'meta_capi_enabled'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN meta_capi_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'meta_pixel_enabled'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN meta_pixel_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_tracking_config' AND column_name = 'meta_test_event_code'
  ) THEN
    ALTER TABLE landing_tracking_config ADD COLUMN meta_test_event_code text NOT NULL DEFAULT '';
  END IF;
END $$;
