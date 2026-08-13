/*
  # Guarantee a single active mercadopago_config row + safety index

  1. Problem
    - `mercadopago_config` was designed as a "single active row" table
      (comment on the original CREATE TABLE), but nothing enforced that.
      `getConfig()`/`saveConfig`/`testCredentials` in the mercadopago and
      mp-admin edge functions all select via
      `.eq("is_active", true).limit(1).maybeSingle()` with NO `ORDER BY`.
      If more than one row ever ends up `is_active = true` (e.g. a
      `saveConfig` race where the "find existing active row" lookup misses
      and a second row gets inserted instead of the first being updated),
      two separate requests (one fetching the public key for the browser,
      one fetching the access token to charge the card) are not guaranteed
      to read the same row — silently pairing a public key from one
      Mercado Pago application with an access token from another, which
      Mercado Pago rejects for essentially every card charge while PIX
      (which never uses the public key) keeps working. This migration
      closes that gap.

  2. Changes
    - Deactivate every `mercadopago_config` row except the most recently
      updated one, if more than one is currently active (no-op if there's
      already just one).
    - Add a partial unique index so the database itself now refuses to ever
      have two active rows again, regardless of application-level bugs.
*/

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
  FROM mercadopago_config
  WHERE is_active = true
)
UPDATE mercadopago_config
SET is_active = false, updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS mercadopago_config_single_active
  ON mercadopago_config ((true))
  WHERE is_active;
