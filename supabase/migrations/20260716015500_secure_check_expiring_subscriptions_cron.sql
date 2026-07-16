/*
  # Require a shared secret on the check-expiring-subscriptions cron call

  1. Background
    - `check-expiring-subscriptions` currently has no authentication at all: anyone who
      finds the URL can trigger it on demand, and it uses the service role key to bulk
      update `users.plan_status` and cancel subscriptions.
    - The Edge Function has been updated to require `Authorization: Bearer <CRON_SECRET>`,
      matching the `CRON_SECRET` function secret.

  2. Changes
    - Re-schedules `check-expiring-subscriptions-cron` to send that header, read from
      Supabase Vault (NOT stored in this file — created separately via
      `select vault.create_secret('<value>', 'cron_secret', ...)` so the value never lands
      in version control). Hosted Supabase does not grant `ALTER DATABASE ... SET` on
      custom GUCs to the SQL Editor role, so Vault is used instead.

  3. Important
    - Create the `cron_secret` Vault entry (see deployment notes) BEFORE applying this
      migration, with the same value as the `CRON_SECRET` function secret. Otherwise the
      cron job will start sending a blank/missing secret and the function will reject it
      with 401.
*/

SELECT cron.unschedule('check-expiring-subscriptions-cron');

SELECT cron.schedule(
  'check-expiring-subscriptions-cron',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/functions/v1/check-expiring-subscriptions',
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
