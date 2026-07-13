/*
  # Add gradient fields to storefront_appearance

  1. Modified Tables
    - `storefront_appearance`
      - `bg_gradient_enabled` (boolean, default false) - Whether background gradient is active
      - `bg_gradient_color_end` (text, nullable) - Second color for the gradient
      - `bg_gradient_direction` (text, default 'to bottom') - CSS gradient direction

  2. Important Notes
    - These fields support the new simplified color configuration
    - When bg_gradient_enabled is true, the storefront renders a CSS linear-gradient
      from bg_color to bg_gradient_color_end in the specified direction
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'storefront_appearance' AND column_name = 'bg_gradient_enabled'
  ) THEN
    ALTER TABLE storefront_appearance ADD COLUMN bg_gradient_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'storefront_appearance' AND column_name = 'bg_gradient_color_end'
  ) THEN
    ALTER TABLE storefront_appearance ADD COLUMN bg_gradient_color_end text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'storefront_appearance' AND column_name = 'bg_gradient_direction'
  ) THEN
    ALTER TABLE storefront_appearance ADD COLUMN bg_gradient_direction text DEFAULT 'to bottom';
  END IF;
END $$;
