/*
  # Add scroll_y column to landing_hero_screens

  1. Modified Tables
    - `landing_hero_screens`
      - Added `scroll_y` (integer, default 0) - vertical scroll offset in pixels
        that controls the visible position of content within the phone mockup

  2. Constraints
    - `valid_scroll_y` - ensures value is between 0 and 2000

  3. Notes
    - Existing rows will get scroll_y = 0 (content shown from the top)
    - Used by the admin panel to configure which part of the mockup content is visible
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'landing_hero_screens' AND column_name = 'scroll_y'
  ) THEN
    ALTER TABLE landing_hero_screens ADD COLUMN scroll_y integer NOT NULL DEFAULT 0;
    ALTER TABLE landing_hero_screens ADD CONSTRAINT valid_scroll_y CHECK (scroll_y >= 0 AND scroll_y <= 2000);
  END IF;
END $$;
