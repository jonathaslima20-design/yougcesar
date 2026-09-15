/*
  # Schedule daily Mercado Pago OAuth token refresh

  Merchant access tokens obtained via "Conectar com Mercado Pago" (OAuth)
  are valid for 180 days. This job runs once a day and refreshes any
  connected merchant's token that is within 15 days of expiring, so
  createPixPayment/createCardPayment never has to refresh synchronously on
  the hot payment-creation path. Same auth pattern as the existing
  expire-pending-pix-payments cron: shared cron_secret from Supabase Vault,
  checked against the function's own CRON_SECRET env var.
*/

SELECT cron.schedule(
  'refresh-merchant-mp-tokens-cron',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/functions/v1/refresh-merchant-mp-tokens',
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
