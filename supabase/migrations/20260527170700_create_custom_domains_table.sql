/*
  # Create custom_domains table for user custom domain management

  1. New Tables
    - `custom_domains`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users, unique - one active domain per user)
      - `domain` (text, unique) - the full custom domain (e.g. "www.minhaloja.com.br")
      - `status` (text) - domain lifecycle status: pending_dns, dns_verified, active, error
      - `verification_token` (text) - random token for DNS TXT verification
      - `error_message` (text, nullable) - error details if status is 'error'
      - `activated_at` (timestamptz, nullable) - when domain was activated on Netlify
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `custom_domains` table
    - Public SELECT policy (visitors need to resolve domains)
    - Authenticated INSERT policy (owner only)
    - Authenticated UPDATE policy (owner only)
    - Authenticated DELETE policy (owner only)

  3. Indexes
    - Unique index on `domain` for fast lookups during resolution
    - Index on `user_id` for user-specific queries

  4. Notes
    - One domain per user enforced via unique constraint on user_id
    - Domain resolution by visitors requires public SELECT access
    - Only users with annual plan can use this feature (enforced at application level)
*/

-- Create custom_domains table
CREATE TABLE IF NOT EXISTS custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending_dns',
  verification_token text NOT NULL,
  error_message text,
  activated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT custom_domains_user_id_key UNIQUE (user_id),
  CONSTRAINT custom_domains_domain_key UNIQUE (domain),
  CONSTRAINT custom_domains_status_check CHECK (status IN ('pending_dns', 'dns_verified', 'active', 'error'))
);

-- Enable RLS
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

-- Public SELECT policy: visitors need to resolve custom domains
CREATE POLICY "Anyone can resolve custom domains"
  ON custom_domains
  FOR SELECT
  USING (status = 'active');

-- Authenticated SELECT: owners can see their own domain (any status)
CREATE POLICY "Users can view own custom domain"
  ON custom_domains
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: only authenticated users can register their own domain
CREATE POLICY "Users can register own custom domain"
  ON custom_domains
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: only owner can update
CREATE POLICY "Users can update own custom domain"
  ON custom_domains
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only owner can delete
CREATE POLICY "Users can delete own custom domain"
  ON custom_domains
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for fast domain lookups during resolution
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain_active
  ON custom_domains (domain) WHERE status = 'active';
