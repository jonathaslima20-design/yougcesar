/*
  # Eletrônicos: rectangular logo, multiple top-bar phrases, section toggles

  1. Changes to storefront_appearance (all "eletronicos"-only, ignored by "padrao")
    - `header_logo_url` (text, nullable) — an optional rectangular logo image for
      the header, shown instead of the square avatar when set.
    - `top_bar_phrases` (jsonb array of text, default `[]`) — replaces the single
      `top_bar_text` with a list that rotates in the announcement bar. Existing
      single phrases are migrated into this array so nothing is lost.
    - `top_bar_enabled` (boolean, default true) — show/hide the announcement bar.
    - `benefits_bar_enabled` (boolean, default true) — show/hide the benefits bar.
    - `mini_banners_enabled` (boolean, default true) — show/hide the mini banners grid.

  2. Notes
    - `top_bar_text` is left in place (unused going forward) rather than dropped,
      so this migration can't destroy data if something reads it unexpectedly.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS header_logo_url text DEFAULT NULL;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS top_bar_phrases jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS top_bar_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS benefits_bar_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS mini_banners_enabled boolean NOT NULL DEFAULT true;

UPDATE storefront_appearance
SET top_bar_phrases = jsonb_build_array(top_bar_text)
WHERE top_bar_text IS NOT NULL AND btrim(top_bar_text) <> '' AND top_bar_phrases = '[]'::jsonb;
