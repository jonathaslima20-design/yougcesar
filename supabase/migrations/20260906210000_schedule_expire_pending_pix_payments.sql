/*
  # Schedule PIX expiry check + stale reservation safety net

  1. Problem
    - Mercado Pago captures a PIX charge's expiration (`date_of_expiration`
      / `order_payments.pix_expires_at`) but never proactively notifies our
      webhook when a QR code simply times out unattended — only actions
      taken against the payment (buyer pays, or an explicit status change)
      trigger a notification. Left alone, an abandoned PIX order keeps its
      stock reservation forever.
    - A buyer can also abandon checkout before ever attempting a payment
      (closing the tab on `OrderPaymentPage` before generating a PIX or
      submitting a card) — there is no `order_payments` row to expire in
      that case, so a PIX-only sweep would miss it.

  2. Fix
    - New `expire-pending-pix-payments` edge function, run every 5 minutes
      (PIX windows are short, typically 30-60 minutes):
      a. Marks `order_payments.status = 'expired'` for pending PIX rows
         past `pix_expires_at` and releases that order's reservation.
      b. Safety net: releases the reservation for any order still
         `payment_status = 'pending'` whose `stock_reserved_at` is older
         than 60 minutes, regardless of whether a payment attempt exists —
         covers the "never even generated a PIX" case and a card stuck in
         `in_process`. Only releases the hold; never touches order/payment
         status, so a delayed webhook approval still works normally.
    - Same auth pattern as the existing partner-pending-payments cron:
      shared `cron_secret` from Supabase Vault, checked against the
      function's own `CRON_SECRET` env var.
*/

SELECT cron.schedule(
  'expire-pending-pix-payments-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/functions/v1/expire-pending-pix-payments',
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
