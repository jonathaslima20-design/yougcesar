/*
  # Add theme_id to storefront_appearance

  1. Changes
    - Add `theme_id` column to `storefront_appearance` (layout/template selector,
      independent from the existing color/typography customization on this table)
    - Default `'padrao'` (current fixed layout), so every existing row keeps the
      current storefront look with no migration of data needed
    - Not gated by plan: unlike the color customization fields on this table
      (which only apply for paid plans via StorefrontThemeProvider), theme_id is
      read directly from the pre-fetched appearance row in useCorretorData,
      available to every store regardless of plan_status

  2. Notes
    - `'eletronicos'` is the first alternative layout (multi-shelf storefront
      theme). More values can be appended later without a new migration.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS theme_id text NOT NULL DEFAULT 'padrao';

ALTER TABLE storefront_appearance
  ADD CONSTRAINT storefront_appearance_theme_id_check
  CHECK (theme_id IN ('padrao', 'eletronicos'));
