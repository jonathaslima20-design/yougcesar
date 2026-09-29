/*
  # Per-merchant allowlist for the Eletronicos theme

  1. Changes
    - Add `eletronicos_allowed_user_ids` (uuid[], default empty) to
      `platform_theme_settings`.

  2. Notes
    - While the global switch `eletronicos_theme_enabled` is off, the theme is
      still available to (and rendered for) the merchants listed here, so a
      single store can keep building/testing it in production before launch.
    - Seeded with the kingstore@live.com account.
    - Same RLS as the rest of the table: public read, admin-only write.
*/

ALTER TABLE platform_theme_settings
  ADD COLUMN IF NOT EXISTS eletronicos_allowed_user_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE platform_theme_settings
SET eletronicos_allowed_user_ids = COALESCE(
  (SELECT array_agg(id) FROM users WHERE lower(email) = 'kingstore@live.com'),
  '{}'
)
WHERE id = 1;
