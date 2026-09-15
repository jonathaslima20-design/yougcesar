/*
  # Remove Cakto as a billing provider

  Reverts 20260911000000_add_cakto_billing_provider.sql. Cakto was explored
  as an alternative BR billing provider but the merchant decided to stay on
  Mercado Pago only for now — no Cakto offers/products were ever configured
  for real traffic. Written as IF EXISTS/conditional throughout so it's a
  safe no-op if the original migration was never actually applied to this
  project.

  - Drops cakto_webhook_events, cakto_payments, cakto_offers, cakto_config.
  - Restores users.billing_provider to only ('mercadopago', 'stripe').
*/

DROP TABLE IF EXISTS cakto_webhook_events;
DROP TABLE IF EXISTS cakto_payments;
DROP TABLE IF EXISTS cakto_offers;
DROP TABLE IF EXISTS cakto_config;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'users'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%billing_provider%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE users ADD CONSTRAINT users_billing_provider_check
    CHECK (billing_provider IN ('mercadopago', 'stripe'));
END $$;
