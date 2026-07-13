/*
  # Add footer logo mode to storefront appearance

  1. Modified Tables
    - `storefront_appearance`
      - `footer_logo_mode` (text, default 'default') - Controls footer logo display: 'default' (show VitrineTurbo), 'hidden' (hide logo/phrase), 'custom' (show user's custom logo)

  2. Notes
    - The `custom_logo_url` column already exists in the table
    - Adding CHECK constraint to ensure valid values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'storefront_appearance' AND column_name = 'footer_logo_mode'
  ) THEN
    ALTER TABLE storefront_appearance ADD COLUMN footer_logo_mode text DEFAULT 'default';
  END IF;
END $$;

ALTER TABLE storefront_appearance
  DROP CONSTRAINT IF EXISTS storefront_appearance_footer_logo_mode_check;

ALTER TABLE storefront_appearance
  ADD CONSTRAINT storefront_appearance_footer_logo_mode_check
  CHECK (footer_logo_mode IN ('default', 'hidden', 'custom'));
