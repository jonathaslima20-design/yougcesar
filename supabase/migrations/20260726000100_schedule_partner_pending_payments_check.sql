/*
  # Schedule hourly check for expired partner-assigned payment deadlines

  1. Problem
    - Partner-created accounts with a selected plan get a payment deadline
      as short as a few hours (default 6h, admin-configurable). The
      existing `check-expiring-subscriptions-cron` job
      (supabase/migrations/20260529211313_enable_pg_cron_schedule_subscription_check.sql)
      only runs every 12 hours and operates on day-resolution dates —
      too coarse to enforce an hours-based deadline meaningfully.

  2. Changes
    - Schedules the new `check-partner-pending-payments` edge function to
      run every hour via pg_cron + pg_net (both already enabled by the
      migration referenced above), authenticated the same way as
      `check-expiring-subscriptions-cron`
      (supabase/migrations/20260716015500_secure_check_expiring_subscriptions_cron.sql):
      the shared secret is read from Supabase Vault (`cron_secret`, already
      created for that job) rather than stored in this file, so it matches
      the `CRON_SECRET` function secret the edge function checks against.
*/

SELECT cron.schedule(
  'check-partner-pending-payments-cron',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/functions/v1/check-partner-pending-payments',
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
