/*
  # Add social_icon_url to users

  1. Changes
    - Add `social_icon_url` (text, nullable) to `users`.

  2. Notes
    - A dedicated square icon (recommended 512x512) for the browser tab favicon
      and the WhatsApp/social share card — separate from `avatar_url` (which the
      "padrão" theme still uses for its circular header photo) and from the
      "eletrônicos" theme's rectangular `header_logo_url` (storefront_appearance),
      neither of which suits a square slot well.
    - NULL falls back to avatar_url, then to the platform's generic icon — no
      existing store needs to do anything.
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS social_icon_url text DEFAULT NULL;
