/*
  # Add store_latitude/store_longitude to users

  1. Changes
    - `users`
      - New columns `store_latitude`, `store_longitude` (numeric, nullable) -
        geocoded from `store_zip_code` (see 20260812100000_add_store_zip_code_to_users.sql)
        via the new `geocode-cep` edge function, at the same point the
        dashboard already resolves city/state from that CEP via ViaCEP.
      - Null means either the merchant hasn't (re)saved their store CEP since
        this feature shipped, or the CEP has no coordinate available from the
        geocoding provider — both are normal, expected states. Anything that
        needs distance-based local delivery must treat a null coordinate as
        "fall back to the existing city-match behavior," never as an error.
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS store_latitude numeric,
  ADD COLUMN IF NOT EXISTS store_longitude numeric;
