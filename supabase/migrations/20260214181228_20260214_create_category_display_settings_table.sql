/*
  # Create category_display_settings table

  1. New Tables
    - `category_display_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `category_name` (text)
      - `display_order` (integer)
      - `is_visible` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `category_display_settings` table
    - Add policy for authenticated users to read and manage their own category settings

  3. Important Notes
    - This table stores user preferences for how categories are displayed
    - Each user can have multiple category display settings
    - The display_order determines the sequence of categories in the dashboard
    - is_visible controls whether a category appears in the Listings view
*/

CREATE TABLE IF NOT EXISTS category_display_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  display_order integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category_name)
);

ALTER TABLE category_display_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category settings"
  ON category_display_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own category settings"
  ON category_display_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category settings"
  ON category_display_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own category settings"
  ON category_display_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_category_display_settings_user_id 
  ON category_display_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_category_display_settings_display_order 
  ON category_display_settings(user_id, display_order);
