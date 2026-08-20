/*
  # Create landing_testimonials table

  ## Summary
  Creates a table to store customer testimonials shown on the public landing
  page, managed by admins through the admin panel (mirrors banner_clients).

  ## New Tables
  - `landing_testimonials`
    - `id` (uuid, primary key)
    - `author_name` (text) - name of the person giving the testimonial
    - `store_name` (text) - name of their store
    - `avatar_url` (text, optional) - photo of the author
    - `quote` (text) - the testimonial text
    - `result_label` (text, optional) - short label for the highlighted result (e.g. "vendas em 3 meses")
    - `result_value` (text, optional) - short value for the highlighted result (e.g. "+180%")
    - `display_order` (integer) - controls the order shown on the landing page
    - `is_active` (boolean) - controls whether this entry is shown publicly
    - `created_at` / `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public (unauthenticated) SELECT allowed only for active records
  - Only admin users (role = 'admin') can INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS landing_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  store_name text NOT NULL DEFAULT '',
  avatar_url text,
  quote text NOT NULL DEFAULT '',
  result_label text,
  result_value text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE landing_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active landing testimonials"
  ON landing_testimonials FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all landing testimonials"
  ON landing_testimonials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert landing testimonials"
  ON landing_testimonials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update landing testimonials"
  ON landing_testimonials FOR UPDATE
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

CREATE POLICY "Admins can delete landing testimonials"
  ON landing_testimonials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_landing_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER landing_testimonials_updated_at
  BEFORE UPDATE ON landing_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_landing_testimonials_updated_at();

CREATE INDEX IF NOT EXISTS idx_landing_testimonials_display_order ON landing_testimonials (display_order);
CREATE INDEX IF NOT EXISTS idx_landing_testimonials_is_active ON landing_testimonials (is_active);
