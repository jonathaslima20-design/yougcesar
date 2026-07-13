/*
  # Add onboarding tracking fields to users table

  1. Modified Tables
    - `users`
      - `onboarding_completed_steps` (text[], default '{}') - Array of completed onboarding step IDs
      - `onboarding_dismissed` (boolean, default false) - Whether user minimized the onboarding panel
      - `onboarding_storefront_viewed` (boolean, default false) - Whether user has viewed their public storefront

  2. Notes
    - These fields track the guided onboarding progress for free users
    - Steps tracked: profile, first_product, view_storefront, share, upgrade
    - onboarding_storefront_viewed is separate because it tracks an action not detectable from other fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'onboarding_completed_steps'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_completed_steps text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'onboarding_dismissed'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_dismissed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'onboarding_storefront_viewed'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_storefront_viewed boolean DEFAULT false;
  END IF;
END $$;
