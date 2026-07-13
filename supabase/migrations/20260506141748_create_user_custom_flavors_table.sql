/*
  # Create User Custom Flavors Table and Add Flavors to Products

  This migration introduces the ability to manage product flavors (sabores). Each user
  maintains their own library of flavors that can be reused across their products. Products
  also get a new `flavors` array column holding the flavors enabled for that product.

  1. New Tables
    - `user_custom_flavors`
      - `id` (uuid, primary key) - Unique identifier for each flavor record
      - `user_id` (uuid, foreign key) - References the user who created the flavor
      - `flavor_name` (text) - The flavor name (e.g., "Morango", "Chocolate")
      - `created_at` (timestamp) - When the flavor was created

  2. Changes to existing tables
    - `products`
      - New column `flavors` (text[] nullable) - Holds the flavor names offered for the
        product. When null or empty, the product has no flavor options.

  3. Security
    - Enable RLS on `user_custom_flavors`
    - Users can SELECT/INSERT/UPDATE/DELETE only their own flavors
    - Composite unique constraint on (user_id, flavor_name) to prevent duplicates

  4. Indexes
    - Index on user_id for fast lookups
*/

CREATE TABLE IF NOT EXISTS user_custom_flavors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flavor_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_flavors_unique UNIQUE(user_id, flavor_name),
  CONSTRAINT flavor_name_not_empty CHECK (length(trim(flavor_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_custom_flavors_user_id ON user_custom_flavors(user_id);

ALTER TABLE user_custom_flavors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom flavors"
  ON user_custom_flavors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom flavors"
  ON user_custom_flavors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom flavors"
  ON user_custom_flavors
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom flavors"
  ON user_custom_flavors
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_custom_flavors TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'flavors'
  ) THEN
    ALTER TABLE products ADD COLUMN flavors text[];
  END IF;
END $$;
