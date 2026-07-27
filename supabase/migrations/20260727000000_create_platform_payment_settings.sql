/*
  # Create platform_payment_settings table (global kill switch)

  ## Summary
  A single platform-wide flag that lets an admin instantly turn the online
  payments feature (Mercado Pago checkout) on or off for every store at once,
  independent of each merchant's own checkout mode setting. Defaults to
  disabled: the feature is still being validated end-to-end, and merchants
  must keep working exactly as before (WhatsApp-only ordering) until an admin
  deliberately flips this on.

  ## New Tables
  - `platform_payment_settings`
    - `id` (int, primary key, always 1 – singleton row pattern)
    - `online_payments_enabled` (boolean, default false)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - SELECT allowed for authenticated and anon users (storefront and edge
    functions need to read this to decide whether to offer online payment)
  - INSERT/UPDATE allowed only for admin users (role = 'admin' in public.users)

  ## Notes
  Singleton pattern, same as `landing_tracking_config`. Row is seeded on
  migration so reads always return data.
*/

CREATE TABLE IF NOT EXISTS platform_payment_settings (
  id integer PRIMARY KEY DEFAULT 1,
  online_payments_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE platform_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform payment settings" ON platform_payment_settings;
CREATE POLICY "Anyone can read platform payment settings"
  ON platform_payment_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert platform payment settings" ON platform_payment_settings;
CREATE POLICY "Admins can insert platform payment settings"
  ON platform_payment_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update platform payment settings" ON platform_payment_settings;
CREATE POLICY "Admins can update platform payment settings"
  ON platform_payment_settings FOR UPDATE
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

INSERT INTO platform_payment_settings (id, online_payments_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
