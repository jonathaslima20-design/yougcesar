/*
  # Create integration_providers table (admin-managed ERP/system catalog)

  1. New Tables
    - `integration_providers`
      - `id` (uuid, primary key)
      - `slug` (text, unique) - stable key the frontend uses to decide which
        connector component to render (e.g. 'olist'). Not every row needs a
        working connector behind it yet — admin can add a provider's name/logo
        ahead of the backend being built, as a "coming soon" placeholder.
      - `name` (text) - display name shown on the card (e.g. "Olist ERP (Tiny)")
      - `description` (text, nullable) - short subtitle on the card
      - `logo_url` (text, nullable) - falls back to a generic icon when null
      - `is_enabled` (boolean) - whether the card appears in the merchant-facing
        Integrações tab at all. Does NOT affect whether the connector itself
        works if a merchant already connected before it was disabled — this is
        purely a visibility switch, same spirit as `platform_payment_settings`.
      - `sort_order` (integer) - display order on the merchant grid
      - `created_at` / `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - SELECT: only rows where is_enabled = true are visible to regular
      authenticated users (merchants reading the grid); admins can read
      everything (including disabled rows, to manage them)
    - INSERT/UPDATE/DELETE: admins only

  3. Notes
    - This table has no secrets in it (unlike merchant_erp_credentials) — it's
      just catalog/display metadata — so unlike the credentials tables it's
      fine for merchants to SELECT it directly client-side without going
      through an edge function.
*/

CREATE TABLE IF NOT EXISTS integration_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  logo_url text,
  is_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE integration_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read enabled integration providers" ON integration_providers;
CREATE POLICY "Anyone can read enabled integration providers"
  ON integration_providers FOR SELECT
  USING (
    is_enabled = true
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert integration providers" ON integration_providers;
CREATE POLICY "Admins can insert integration providers"
  ON integration_providers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update integration providers" ON integration_providers;
CREATE POLICY "Admins can update integration providers"
  ON integration_providers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete integration providers" ON integration_providers;
CREATE POLICY "Admins can delete integration providers"
  ON integration_providers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_integration_providers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_integration_providers_updated_at ON integration_providers;
CREATE TRIGGER trigger_integration_providers_updated_at
  BEFORE UPDATE ON integration_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_providers_updated_at();

-- Seed the Olist row so it appears immediately (disabled by default — an
-- admin must deliberately turn it on, same "off until validated" posture as
-- platform_payment_settings).
INSERT INTO integration_providers (slug, name, description, is_enabled, sort_order)
VALUES ('olist', 'Olist ERP (Tiny)', 'Estoque e produtos', false, 0)
ON CONFLICT (slug) DO NOTHING;
