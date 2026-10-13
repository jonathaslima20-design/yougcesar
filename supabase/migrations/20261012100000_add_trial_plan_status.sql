/*
  # Add trial plan status support

  Two new plan_status values power the 15-day trial feature (trial referral
  link + admin-created trial users):
    - 'trial': full access, same as 'active', while trial_ends_at is in the future.
    - 'trial_expired': blocked like 'expired', but SubscriptionModal shows a
      distinct "seu período de teste acabou" message instead of "plano vencido".

  trial_ends_at is the single source of truth for both the countdown and (combined
  with referred_by) for distinguishing trial origin at read time — no separate
  "origin" column:
    - referred_by set + trial_ends_at set      -> referral-trial signup
    - referred_by set + trial_ends_at null     -> direct referral (unchanged)
    - referred_by null + trial_ends_at set     -> admin-created trial user
    - neither set                              -> organic signup

  The partial index keeps the expiration cron's scan cheap regardless of table size.
*/

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_status_check;

ALTER TABLE users ADD CONSTRAINT users_plan_status_check
  CHECK (plan_status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'free'::text, 'expired'::text, 'trial'::text, 'trial_expired'::text]));

ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_trial_pending
  ON users (trial_ends_at)
  WHERE plan_status = 'trial';
