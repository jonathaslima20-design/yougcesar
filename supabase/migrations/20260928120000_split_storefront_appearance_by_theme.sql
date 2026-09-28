/*
  # Split storefront_appearance customization per theme

  1. Problem
    - `storefront_appearance` has one row per user_id, shared by both storefront
      themes ("padrao" and "eletronicos"). Its own `theme_id` column was doing
      double duty: which layout is active AND which theme the colors "belong" to.
      In practice the colors on that single row only ever affected the "padrao"
      theme's markup (the "eletronicos" theme's header/footer/nav render fixed
      Tailwind classes, ignoring the `--sf-*` tokens entirely) — so switching to
      "eletronicos" left the whole "Cores e tipografia" settings section dead,
      and "Identidade visual" (cover/promotional banner) visible even though
      that theme doesn't use either field.

  2. Changes
    - `users.active_storefront_theme_id`: new column, the single source of truth
      for which layout a store currently shows. Backfilled from each user's
      existing `storefront_appearance.theme_id` so current stores keep whatever
      they already see today.
    - `storefront_appearance`: uniqueness moves from `(user_id)` to
      `(user_id, theme_id)`, so each store can hold one customized color/typography
      row per theme instead of a single shared row. `theme_id` on this table now
      only tags which theme a given row's colors belong to.
    - `storefront_appearance.header_bg_color` / `header_text_color`: new columns
      for the "eletronicos" theme's dark header/topbar/category-nav/footer chrome
      (defaults match the color those elements were hardcoded to, so existing
      stores render unchanged until a merchant customizes them).
    - `storefront_appearance.top_bar_text`: new nullable column for the
      announcement-bar phrase above the eletronicos header (falls back to the
      previous hardcoded "Fale com a gente pelo WhatsApp" in the UI when null).

  3. Notes
    - The "padrao" theme keeps ignoring header_bg_color/header_text_color/top_bar_text
      entirely — those three columns only mean something to "eletronicos".
    - No data is lost: every existing storefront_appearance row keeps its id and
      theme_id: it becomes that store's row for whichever theme it already was.
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_storefront_theme_id text NOT NULL DEFAULT 'padrao';

ALTER TABLE users
  ADD CONSTRAINT users_active_storefront_theme_id_check
  CHECK (active_storefront_theme_id IN ('padrao', 'eletronicos'));

UPDATE users u
SET active_storefront_theme_id = sa.theme_id
FROM storefront_appearance sa
WHERE sa.user_id = u.id;

ALTER TABLE storefront_appearance
  DROP CONSTRAINT IF EXISTS storefront_appearance_user_id_key;

ALTER TABLE storefront_appearance
  ADD CONSTRAINT storefront_appearance_user_id_theme_id_key UNIQUE (user_id, theme_id);

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS header_bg_color text NOT NULL DEFAULT '#171717';

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS header_text_color text NOT NULL DEFAULT '#ffffff';

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS top_bar_text text DEFAULT NULL;
