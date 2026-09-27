/*
  # Revoke anon EXECUTE from the admin "Vendas Online" RPCs

  ## Summary
  Supabase grants EXECUTE on every new function in `public` directly to `anon`,
  `authenticated` and `service_role` (default privileges). The previous
  migrations only ran `REVOKE ALL ... FROM PUBLIC`, which does not remove those
  direct grants, so `anon` could still call these functions.

  It was never a data leak — every function raises 'Acesso negado' unless
  `public.is_admin()` (which is false for an unauthenticated caller) — but an
  admin-only function should not be callable by visitors at all.

  ## Changes
  Removes EXECUTE from `anon` on:
  - admin_online_sales_overview / admin_online_sales_by_merchant / admin_failed_payments
  - admin_orders_ranking
  - _order_payment_fee_cents (internal helper)

  `authenticated` keeps EXECUTE (the admin page calls these with the admin's own
  session); the is_admin() check inside each function is the real gate.
*/

REVOKE EXECUTE ON FUNCTION public.admin_online_sales_overview(timestamptz, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_online_sales_by_merchant(timestamptz, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_failed_payments(timestamptz, timestamptz, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_orders_ranking(timestamptz, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public._order_payment_fee_cents(jsonb) FROM anon;
