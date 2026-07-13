/*
  # Add footer_logo_format to storefront_appearance

  1. Modified Tables
    - `storefront_appearance`
      - `footer_logo_format` (text, default 'rectangular') - Shape of custom footer logo: 'rectangular' (160x40) or 'square' (160x160)

  2. Notes
    - Existing rows get the default value 'rectangular'
    - CHECK constraint enforces valid values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'storefront_appearance' AND column_name = 'footer_logo_format'
  ) THEN
    ALTER TABLE storefront_appearance ADD COLUMN footer_logo_format text DEFAULT 'rectangular';
  END IF;
END $$;

ALTER TABLE storefront_appearance
  DROP CONSTRAINT IF EXISTS storefront_appearance_footer_logo_format_check;

ALTER TABLE storefront_appearance
  ADD CONSTRAINT storefront_appearance_footer_logo_format_check
  CHECK (footer_logo_format IN ('rectangular', 'square'));
