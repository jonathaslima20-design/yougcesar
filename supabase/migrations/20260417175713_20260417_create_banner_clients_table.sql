/*
  # Create banner_clients table

  ## Summary
  Creates a table to store client showcase entries for the social proof banner
  shown in the subscription/plans modal.

  ## New Tables
  - `banner_clients`
    - `id` (uuid, primary key) - unique identifier
    - `corretor_page_url` (text) - full URL of the corretor page pasted by admin
    - `business_name` (text) - auto-fetched business/display name from the corretor profile
    - `avatar_url` (text, optional) - auto-fetched avatar image URL from the corretor profile
    - `display_order` (integer) - controls the order in the marquee banner
    - `is_active` (boolean) - controls whether this entry shows in the banner
    - `created_at` (timestamptz) - record creation timestamp
    - `updated_at` (timestamptz) - record last update timestamp

  ## Security
  - RLS enabled
  - Public (unauthenticated) SELECT allowed only for active records
  - Only admin users (role = 'admin') can INSERT, UPDATE, DELETE

  ## Notes
  1. The avatar_url and business_name are populated at creation time by the admin panel
     by extracting the slug from the URL and querying the users table
  2. display_order defaults to 0 and should be set by the admin for consistent ordering
*/

CREATE TABLE IF NOT EXISTS banner_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_page_url text NOT NULL,
  business_name text NOT NULL DEFAULT '',
  avatar_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE banner_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banner clients"
  ON banner_clients FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all banner clients"
  ON banner_clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert banner clients"
  ON banner_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update banner clients"
  ON banner_clients FOR UPDATE
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

CREATE POLICY "Admins can delete banner clients"
  ON banner_clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_banner_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER banner_clients_updated_at
  BEFORE UPDATE ON banner_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_banner_clients_updated_at();

CREATE INDEX IF NOT EXISTS idx_banner_clients_display_order ON banner_clients (display_order);
CREATE INDEX IF NOT EXISTS idx_banner_clients_is_active ON banner_clients (is_active);
