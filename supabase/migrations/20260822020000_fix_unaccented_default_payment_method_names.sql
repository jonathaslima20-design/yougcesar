/*
  # Fix unaccented default payment method names

  1. Problem
    - `user_storefront_settings.settings.checkout.paymentMethods` stores each
      payment method's display name inline. Some stores still carry the
      unaccented names an older version of the app used to write
      ("Cartao de Credito", "Cartao de Debito", "Transferencia Bancaria")
      instead of the correctly accented ones the current code has always
      created for new stores.

  2. Fix
    - For every store, rewrite only the entries whose `id` matches one of the
      5 built-in reserved payment method ids to the correct accented name.
    - Custom (merchant-added) payment methods have any other `id` and are
      left completely untouched — only the reserved ids' `name` field is
      ever overwritten.
    - Idempotent: rows already using the correct name are rewritten to the
      same value, so this is safe to run more than once.
*/

UPDATE user_storefront_settings
SET settings = jsonb_set(
  settings,
  '{checkout,paymentMethods}',
  (
    SELECT jsonb_agg(
      CASE elem->>'id'
        WHEN 'pix' THEN jsonb_set(elem, '{name}', '"PIX"')
        WHEN 'credit_card' THEN jsonb_set(elem, '{name}', '"Cartão de Crédito"')
        WHEN 'debit_card' THEN jsonb_set(elem, '{name}', '"Cartão de Débito"')
        WHEN 'cash' THEN jsonb_set(elem, '{name}', '"Dinheiro"')
        WHEN 'bank_transfer' THEN jsonb_set(elem, '{name}', '"Transferência Bancária"')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(settings #> '{checkout,paymentMethods}') AS elem
  )
)
WHERE jsonb_typeof(settings #> '{checkout,paymentMethods}') = 'array';
