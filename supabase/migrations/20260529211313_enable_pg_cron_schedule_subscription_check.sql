/*
  # Enable pg_cron and schedule automatic subscription expiration check

  1. Extensions Enabled
    - `pg_cron` - Job scheduler for PostgreSQL
    - `pg_net` - Async HTTP client for PostgreSQL

  2. Scheduled Jobs
    - `check-expiring-subscriptions-cron` - Runs every 12 hours (at 00:00 and 12:00 UTC)
    - Calls the `check-expiring-subscriptions` Edge Function via HTTP POST
    - Automatically marks users as expired after 2-day grace period past subscription_end_date

  3. Purpose
    - Ensures users with overdue subscriptions are blocked automatically
    - Sends notifications at 7 days before expiry, during grace period, and upon block
    - Excludes admin and parceiro roles from expiration logic
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule the check-expiring-subscriptions Edge Function to run every 12 hours
SELECT cron.schedule(
  'check-expiring-subscriptions-cron',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/functions/v1/check-expiring-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);