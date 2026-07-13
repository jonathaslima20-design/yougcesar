/*
  # Add owner_name field to users table

  1. Modified Tables
    - `users`
      - Added `owner_name` (text, nullable) - stores the personal name of the account owner
      - The existing `name` column continues to represent the business/store name
  
  2. Purpose
    - Separates personal identity (owner_name) from business identity (name)
    - owner_name is shown in the dashboard/account area
    - name continues to be displayed on the public storefront (CorretorPage)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'owner_name'
  ) THEN
    ALTER TABLE users ADD COLUMN owner_name text;
  END IF;
END $$;
