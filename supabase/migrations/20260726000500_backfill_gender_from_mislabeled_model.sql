/*
  # Backfill products.gender from products.model

  The product Create/Edit dashboard forms had a bug: the "Gênero" selector was
  bound to the `model` column instead of the `gender` column. Every product
  saved through those forms got "Masculino" / "Feminino" / "Unissex" written
  into `model`, while `gender` was left null.

  This migration only touches rows where `model` is EXACTLY one of those three
  values (case-sensitive) — the precise strings the buggy selector writes —
  and `gender` is still null. Products with genuine model text (e.g. imported
  via CSV, which has always had separate `modelo`/`genero` columns) are left
  untouched, since a real model name would not coincidentally match one of
  these three exact strings.

  Safe to run more than once: rows already backfilled no longer match the
  `model IN (...)` + `gender IS NULL` condition, so a second run is a no-op
  except for catching any new stragglers created between deploys.
*/

UPDATE products
SET
  gender = CASE model
    WHEN 'Masculino' THEN 'masculino'
    WHEN 'Feminino' THEN 'feminino'
    WHEN 'Unissex' THEN 'unissex'
  END,
  model = NULL
WHERE model IN ('Masculino', 'Feminino', 'Unissex')
  AND gender IS NULL;
