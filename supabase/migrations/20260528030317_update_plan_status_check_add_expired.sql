/*
  # Update plan_status check constraint to include 'expired'

  1. Changes
    - Drops the existing `users_plan_status_check` constraint
    - Recreates it with the additional 'expired' value
    - This allows the system to mark users as expired when their subscription lapses

  2. Important Notes
    - The 'inactive' value is kept for backwards compatibility even though
      we now prefer 'expired' for payment-related blocks
    - No data is lost or modified by this change
*/

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_status_check;

ALTER TABLE users ADD CONSTRAINT users_plan_status_check
  CHECK (plan_status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'free'::text, 'expired'::text]));
