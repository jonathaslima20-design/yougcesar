/*
  # Create User Activity Logs System

  1. New Tables
    - `user_activity_logs`
      - `id` (uuid, primary key) - Unique log entry identifier
      - `user_id` (uuid, FK to users) - User who performed the action
      - `action` (text) - Action identifier (e.g., "product.create", "auth.login")
      - `entity_type` (text, nullable) - Type of entity involved (e.g., "product", "category")
      - `entity_id` (text, nullable) - ID of the entity involved
      - `description` (text) - Human-readable description in Portuguese
      - `ip_address` (text, nullable) - IP address of the user
      - `user_agent` (text, nullable) - Browser user agent string
      - `created_at` (timestamptz) - When the action occurred

  2. Modified Tables
    - `users`
      - Added `last_login_at` (timestamptz, nullable) - Timestamp of last login
      - Added `login_count` (integer, default 0) - Total number of logins

  3. Security
    - Enable RLS on `user_activity_logs`
    - Admins can read all logs
    - Authenticated users can insert their own logs
    - No update or delete allowed via client

  4. Indexes
    - Composite index on (user_id, created_at DESC) for fast user-specific queries
    - Index on (action) for filtering by event type
    - Index on (created_at) for cleanup job

  5. Scheduled Cleanup
    - pg_cron job to delete logs older than 60 days, runs daily at 03:00 UTC
*/

-- Create user_activity_logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  description text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
  ON user_activity_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON user_activity_logs (action);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON user_activity_logs (created_at);

-- Enable RLS
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all activity logs
CREATE POLICY "Admins can read all activity logs"
  ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Authenticated users can insert their own activity logs
CREATE POLICY "Users can insert own activity logs"
  ON user_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add last_login_at and login_count to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'login_count'
  ) THEN
    ALTER TABLE users ADD COLUMN login_count integer DEFAULT 0;
  END IF;
END $$;

-- Schedule daily cleanup of logs older than 60 days (runs at 03:00 UTC)
SELECT cron.schedule(
  'cleanup-old-activity-logs',
  '0 3 * * *',
  $$DELETE FROM public.user_activity_logs WHERE created_at < now() - interval '60 days'$$
);