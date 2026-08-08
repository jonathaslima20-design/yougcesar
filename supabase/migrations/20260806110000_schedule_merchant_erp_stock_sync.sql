/*
  # Schedule automatic Olist ERP stock sync every 15 minutes

  1. Background
    - Olist's v3 API has no webhooks, so there is no way for VitrineTurbo to be
      notified when stock changes on the merchant's ERP side. The only option
      is polling. Until now this only happened when a merchant manually
      clicked "Sincronizar Estoque".
    - `merchant-erp-cron-sync` (new Edge Function) does this automatically:
      every 15 minutes it processes a batch of connected merchants (oldest
      last_synced_at first) and refreshes stock_quantity for their
      Olist-linked products.

  2. Changes
    - Schedules `merchant-erp-cron-sync-job` via pg_cron, same shared-secret
      pattern as `check-expiring-subscriptions-cron`
      (see 20260716015500_secure_check_expiring_subscriptions_cron.sql):
      Authorization header pulled from Vault (`cron_secret`), never stored in
      this file or version control.

  3. Important
    - Requires the SAME `cron_secret` Vault entry already used by
      check-expiring-subscriptions-cron, and requires a `CRON_SECRET` function
      secret (matching that Vault value) to be set on the
      `merchant-erp-cron-sync` Edge Function specifically — function secrets
      are per-function, so this must be configured separately even though the
      Vault value is shared.
    - 15 minutes balances staleness against Olist's per-account rate limit
      (30-140 req/min depending on plan) and this project's own Edge Function
      execution time limits — see the caps documented in
      merchant-erp-cron-sync/index.ts (MAX_MERCHANTS_PER_RUN,
      MAX_PRODUCTS_PER_MERCHANT). A merchant with a very large linked catalog
      may take a few runs to fully catch up, not one.
*/

SELECT cron.unschedule('merchant-erp-cron-sync-job')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'merchant-erp-cron-sync-job');

SELECT cron.schedule(
  'merchant-erp-cron-sync-job',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/functions/v1/merchant-erp-cron-sync',
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
