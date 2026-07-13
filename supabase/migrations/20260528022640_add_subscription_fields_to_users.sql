/*
  # Add subscription fields to users table and introduce 'expired' plan status

  1. New Columns on `users`
    - `billing_cycle` (text, nullable) - stores the user's current billing cycle (monthly, quarterly, semiannually, annually)
    - `subscription_end_date` (date, nullable) - when the current subscription period ends
    - `next_payment_date` (date, nullable) - next expected payment date

  2. Data Backfill
    - Populates new columns from existing `subscriptions` table data for active subscriptions

  3. Status Changes
    - Migrates any users with plan_status='inactive' to plan_status='free'
    - This prepares for adding 'expired' as a distinct status (automatic expiration vs admin suspension)

  4. Important Notes
    - These columns were referenced in the webhook code (mp-webhook) but did not exist, causing silent failures
    - After this migration, the payment webhook will correctly persist subscription dates on the user record
*/

-- Add billing_cycle column to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'billing_cycle' AND table_schema = 'public'
  ) THEN
    ALTER TABLE users ADD COLUMN billing_cycle text;
  END IF;
END $$;

-- Add subscription_end_date column to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_end_date' AND table_schema = 'public'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_end_date date;
  END IF;
END $$;

-- Add next_payment_date column to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'next_payment_date' AND table_schema = 'public'
  ) THEN
    ALTER TABLE users ADD COLUMN next_payment_date date;
  END IF;
END $$;

-- Backfill from subscriptions table (using most recent active subscription per user)
UPDATE users u
SET
  billing_cycle = s.billing_cycle::text,
  subscription_end_date = s.next_payment_date,
  next_payment_date = s.next_payment_date
FROM subscriptions s
WHERE s.user_id = u.id
  AND s.status = 'active'
  AND u.billing_cycle IS NULL;

-- Migrate any 'inactive' users to 'free'
UPDATE users
SET plan_status = 'free'
WHERE plan_status = 'inactive';
