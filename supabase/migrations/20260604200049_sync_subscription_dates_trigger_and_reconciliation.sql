/*
  # Sync subscription dates trigger and initial reconciliation

  1. New Function
    - `sync_subscription_dates_to_user()` - Automatically propagates
      `next_payment_date` from `subscriptions` to both `next_payment_date`
      and `subscription_end_date` on the `users` table whenever a
      subscription is inserted or updated.

  2. New Trigger
    - `trigger_sync_subscription_dates` on `subscriptions` table
    - Fires AFTER INSERT or UPDATE
    - Only runs when next_payment_date actually changes (or on INSERT)

  3. Data Reconciliation
    - One-time UPDATE to sync existing subscription dates to users table
    - Copies the latest subscription's next_payment_date to both
      users.next_payment_date and users.subscription_end_date
    - Only affects users who have an active or pending subscription

  4. Important Notes
    - Uses SECURITY DEFINER to ensure the trigger can update users table
    - subscription_end_date and next_payment_date on users will always be identical
*/

-- Create the sync function
CREATE OR REPLACE FUNCTION sync_subscription_dates_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET
    next_payment_date = NEW.next_payment_date,
    subscription_end_date = NEW.next_payment_date
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trigger_sync_subscription_dates ON subscriptions;

CREATE TRIGGER trigger_sync_subscription_dates
  AFTER INSERT OR UPDATE OF next_payment_date
  ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_dates_to_user();

-- Reconcile existing data: sync latest subscription dates to users
UPDATE users u
SET
  next_payment_date = sub.next_payment_date,
  subscription_end_date = sub.next_payment_date
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    next_payment_date
  FROM subscriptions
  WHERE status IN ('active', 'pending')
  ORDER BY user_id, created_at DESC
) sub
WHERE u.id = sub.user_id
  AND sub.next_payment_date IS NOT NULL;
