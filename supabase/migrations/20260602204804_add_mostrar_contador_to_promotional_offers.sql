/*
  # Add countdown toggle to promotional offers

  1. Modified Tables
    - `promotional_offers`
      - Added `mostrar_contador` (boolean, default false) - Controls whether a countdown timer is shown on the offer display

  2. Notes
    - The countdown uses the existing `data_fim` field as the target date
    - Only displayed when both `mostrar_contador = true` AND `data_fim` is set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotional_offers' AND column_name = 'mostrar_contador'
  ) THEN
    ALTER TABLE promotional_offers ADD COLUMN mostrar_contador boolean DEFAULT false;
  END IF;
END $$;
