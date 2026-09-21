/*
  # Create geocoded_ceps cache table

  1. New Tables
    - `geocoded_ceps`
      - `cep` (text, primary key) - 8-digit CEP, no formatting
      - `latitude` / `longitude` (numeric, nullable) - null means this CEP was
        looked up but no coordinate is available from the provider (a normal,
        expected outcome, not an error)
      - `city` / `state` (text, nullable) - kept alongside the coordinate for
        debugging/support, not used as the source of truth for address
        display anywhere (ViaCEP via src/lib/viaCep.ts remains that)
      - `source` (text, default 'brasilapi') - which provider answered
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - No client-side policies: only the `geocode-cep` edge function (service
      role) reads/writes this table. It exists purely to avoid re-hitting the
      free BrasilAPI CEP endpoint for the same CEP across many buyers/orders.
*/

CREATE TABLE IF NOT EXISTS geocoded_ceps (
  cep text PRIMARY KEY,
  latitude numeric,
  longitude numeric,
  city text,
  state text,
  source text NOT NULL DEFAULT 'brasilapi',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE geocoded_ceps ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (via the geocode-cep edge function) can
-- read or write this table.
