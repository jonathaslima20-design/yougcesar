/*
  # Stripe grace period on failed payment (plan section 2.7)

  1. Background
    - Mercado Pago already has an app-side grace period: check-expiring-subscriptions
      (supabase/migrations/20260529211313_enable_pg_cron_schedule_subscription_check.sql)
      keeps plan_status='active' for GRACE_PERIOD_DAYS=2 past subscription_end_date
      before blocking, running every 12h via pg_cron.
    - Stripe had no equivalent: invoice.payment_failed only logged a warning and relied
      entirely on Stripe's own Smart Retries + eventual customer.subscription.deleted,
      which can take much longer than the 7 days the plan calls for and isn't
      independently enforced by the app.

  2. Changes
    - users.payment_failed_at (nullable timestamptz): set by stripe-webhook on the
      FIRST invoice.payment_failed for a billing cycle (not reset on each Smart Retry
      attempt), cleared on the next successful payment. NULL means no pending failure.
    - New check-stripe-grace-period-cron job (every 12h, same cadence as the Mercado
      Pago job): after 7 days with payment_failed_at still set and plan_status still
      'active', downgrades to plan_status='expired' (same status Stripe's own
      customer.subscription.deleted handler already uses) and notifies the user.
    - Reuses the existing cron_secret Vault entry and CRON_SECRET function secret
      already set up for check-expiring-subscriptions-cron / check-partner-pending-
      payments-cron (see 20260716015500_secure_check_expiring_subscriptions_cron.sql)
      — no new secret needs to be created.
    - Deliberately a separate function from check-expiring-subscriptions rather than
      folding Stripe logic into it: that function is Mercado-Pago-specific throughout
      (explicit .neq('billing_provider','stripe') filters, subscriptions-table sync),
      matching this codebase's existing pattern of keeping the two providers'
      subscription-lifecycle logic decoupled (see stripe-webhook's own
      upsertActiveSubscription comment).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'payment_failed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN payment_failed_at timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN users.payment_failed_at IS 'Stripe only: timestamp of the first invoice.payment_failed since the last successful payment. NULL = no pending failure. check-stripe-grace-period-cron blocks the user 7 days after this is set unless a payment succeeds first.';

SELECT cron.schedule(
  'check-stripe-grace-period-cron',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/functions/v1/check-stripe-grace-period',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
