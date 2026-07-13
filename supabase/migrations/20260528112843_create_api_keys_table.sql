/*
  # Create API Keys table for external integrations

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `key_hash` (text, SHA-256 hash of the API key)
      - `key_prefix` (varchar(12), visible prefix for identification)
      - `name` (text, description like "Bling Integration")
      - `permissions` (text array, e.g. products:read, orders:write)
      - `rate_limit_per_minute` (int, default 60)
      - `is_active` (boolean, default true)
      - `last_used_at` (timestamptz, nullable)
      - `expires_at` (timestamptz, nullable)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `api_keys` table
    - Users can only manage their own API keys
    - Index on key_hash for fast lookups

  3. Notes
    - API keys are stored as SHA-256 hashes only (never plaintext)
    - The key_prefix allows users to identify keys without exposing the full key
    - Available only for users on annual plan (enforced at application level)
*/

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix varchar(12) NOT NULL,
  name text NOT NULL DEFAULT '',
  permissions text[] NOT NULL DEFAULT ARRAY['products:read', 'orders:read', 'stock:read', 'categories:read', 'coupons:read', 'store:read'],
  rate_limit_per_minute int NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON api_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
