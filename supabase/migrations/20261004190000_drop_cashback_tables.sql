-- Remove cashback from the database (step 3 of 3). Run only after step 2
-- (20261004180000) is applied and the balances were confirmed to be empty:
--   select count(*) from cashback_balances;  -- 0 on 2026-10-04
-- Nothing else references these objects any more: the order RPCs no longer
-- credit or debit cashback, and the frontend no longer reads the tables.

DROP FUNCTION IF EXISTS public.credit_cashback_for_order(uuid, uuid);
DROP TABLE IF EXISTS public.cashback_transactions;
DROP TABLE IF EXISTS public.cashback_balances;
