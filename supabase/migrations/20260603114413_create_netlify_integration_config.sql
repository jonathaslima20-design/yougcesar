/*
  # Netlify Integration Config

  Stores Netlify API credentials (Access Token and Site ID) used by the
  manage-custom-domain edge function. Allows admin to update credentials
  through the admin panel instead of editing edge function secrets.

  1. New Tables
    - `netlify_integration_config`
      - `id` (uuid, primary key)
      - `access_token` (text) - Netlify personal access token
      - `site_id` (text) - Netlify site ID
      - `site_name` (text, optional) - Reference label for the site
      - `updated_by` (uuid, references users.id)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on `netlify_integration_config`
    - Only admin users can SELECT, INSERT, UPDATE, DELETE
    - Edge functions access this table via SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)

  3. Notes
    - Singleton pattern: there should only ever be one row in this table
*/

CREATE TABLE IF NOT EXISTS netlify_integration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL DEFAULT '',
  site_id text NOT NULL DEFAULT '',
  site_name text DEFAULT '',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE netlify_integration_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view netlify config"
  ON netlify_integration_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert netlify config"
  ON netlify_integration_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update netlify config"
  ON netlify_integration_config FOR UPDATE
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

CREATE POLICY "Admins can delete netlify config"
  ON netlify_integration_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
