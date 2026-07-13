/*
  # Add Free Plan Support

  ## Summary
  This migration adds support for a "Free" plan tier that users receive automatically
  upon registration. Instead of being blocked from the platform, users on the Free plan
  can use the system with limits on products (20) and categories (5).

  ## Changes

  ### 1. Users Table
  - Drop and recreate the plan_status check constraint to include 'free'
  - Update `plan_status` default from 'inactive' to 'free'
  - Existing users with plan_status = 'inactive' are updated to 'free'

  ### 2. Subscription Plans Table
  - Drop and recreate the duration check constraint to include 'Free'
  - Add `product_limit` column: max products allowed (NULL = unlimited)
  - Add `category_limit` column: max categories allowed (NULL = unlimited)
  - Insert the Free plan entry with product_limit=20, category_limit=5

  ## Security
  - No RLS changes needed; existing policies cover all new columns

  ## Important Notes
  1. The Free plan has price=0 and no checkout_url (no payment required)
  2. Users on the Free plan can access the platform normally, subject to limits
  3. Existing 'active' and 'suspended' users are NOT affected
*/

-- 1. Fix users plan_status constraint first
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_plan_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_plan_status_check
  CHECK (plan_status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'free'::text]));

-- Update default plan_status for new users
ALTER TABLE users
  ALTER COLUMN plan_status SET DEFAULT 'free';

-- Migrate existing inactive users to free plan
UPDATE users
SET plan_status = 'free', updated_at = now()
WHERE plan_status = 'inactive';

-- 2. Fix subscription_plans duration constraint
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_duration_check;

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_duration_check
  CHECK (duration = ANY (ARRAY['Mensal'::text, 'Trimestral'::text, 'Semestral'::text, 'Anual'::text, 'Free'::text]));

-- Add limit columns to subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS product_limit integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category_limit integer DEFAULT NULL;

-- Insert the Free plan (only if it doesn't exist yet)
INSERT INTO subscription_plans (name, duration, price, is_active, display_order, product_limit, category_limit, created_at, updated_at)
SELECT 'Plano Free', 'Free', 0, true, 0, 20, 5, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_plans WHERE duration = 'Free'
);
