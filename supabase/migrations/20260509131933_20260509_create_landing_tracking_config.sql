/*
  # Create landing_tracking_config table

  ## Summary
  Stores the Meta Pixel ID and Google Tag (GTM/GA4) ID that should be injected
  into the public Landing Page. Only admins can write; public can read.

  ## New Tables
  - `landing_tracking_config`
    - `id` (int, primary key, always 1 – singleton row pattern)
    - `meta_pixel_id` (text) – Facebook/Meta Pixel numeric ID
    - `google_tag_id` (text) – Google Tag Manager (GTM-XXXXX) or GA4 (G-XXXXXXX) ID
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - SELECT allowed for authenticated and anon users (Landing Page is public)
  - INSERT/UPDATE allowed only for admin users (role = 'admin' in public.users)
  - No DELETE policy (singleton row should never be deleted)

  ## Notes
  1. Singleton pattern: id is always 1 via CHECK constraint.
  2. Row is seeded on migration so reads always return data.
*/

CREATE TABLE IF NOT EXISTS landing_tracking_config (
  id integer PRIMARY KEY DEFAULT 1,
  meta_pixel_id text NOT NULL DEFAULT '',
  google_tag_id text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE landing_tracking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tracking config"
  ON landing_tracking_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert tracking config"
  ON landing_tracking_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update tracking config"
  ON landing_tracking_config FOR UPDATE
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

INSERT INTO landing_tracking_config (id, meta_pixel_id, google_tag_id)
VALUES (1, '', '')
ON CONFLICT (id) DO NOTHING;
