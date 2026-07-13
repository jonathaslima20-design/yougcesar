/*
  # Create Orphaned Files Cache System

  ## Overview
  This migration creates two tables to support high-performance orphaned file management.
  The system separates scan (slow) from list/delete (fast) operations.

  ## New Tables

  ### 1. `orphaned_files_scan_status`
  Singleton row tracking the state of storage scan operations:
  - `id` - Always 1 (singleton)
  - `status` - 'idle', 'scanning', 'ready', 'error'
  - `started_at` / `completed_at` - Scan timing
  - `total_files_found` - Count of orphaned files found
  - `total_size_bytes` - Total size of all orphaned files
  - `error_message` - Error details if scan failed
  - `scanned_by` - User ID who triggered the scan

  ### 2. `orphaned_files_cache`
  Stores scan results for fast paginated reads without re-scanning storage:
  - `id` - UUID primary key
  - `name` / `path` - File path in storage
  - `size` - File size in bytes
  - `created_at_storage` - When file was created in storage
  - `bucket` - Storage bucket name
  - `is_product_image` / `is_user_image` - File type classification
  - `public_url` - Public URL of the file
  - `scanned_at` - When this cache entry was created

  ## Security
  - RLS enabled on both tables
  - Only users with role='admin' can access these tables
  - Service role (edge functions) bypasses RLS

  ## Performance
  - Index on scanned_at for ordered pagination
  - Index on name for deduplication
  - Index on type flags for filtering
*/

CREATE TABLE IF NOT EXISTS orphaned_files_scan_status (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'scanning', 'ready', 'error')),
  started_at timestamptz,
  completed_at timestamptz,
  total_files_found integer DEFAULT 0,
  total_size_bytes bigint DEFAULT 0,
  error_message text,
  scanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO orphaned_files_scan_status (id, status) VALUES (1, 'idle')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS orphaned_files_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  path text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  created_at_storage timestamptz,
  bucket text NOT NULL DEFAULT 'public',
  is_product_image boolean NOT NULL DEFAULT false,
  is_user_image boolean NOT NULL DEFAULT false,
  public_url text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orphaned_files_cache_scanned_at_idx ON orphaned_files_cache(scanned_at DESC);
CREATE INDEX IF NOT EXISTS orphaned_files_cache_name_idx ON orphaned_files_cache(name);
CREATE INDEX IF NOT EXISTS orphaned_files_cache_type_idx ON orphaned_files_cache(is_product_image, is_user_image);

ALTER TABLE orphaned_files_scan_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE orphaned_files_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read scan status"
  ON orphaned_files_scan_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update scan status"
  ON orphaned_files_scan_status FOR UPDATE
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

CREATE POLICY "Admins can read cache"
  ON orphaned_files_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert cache"
  ON orphaned_files_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete cache"
  ON orphaned_files_cache FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
