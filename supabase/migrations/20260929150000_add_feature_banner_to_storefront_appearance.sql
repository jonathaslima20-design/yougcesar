/*
  # Eletrônicos: "Banner de destaque" (single wide banner between shelves)

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `feature_banner_enabled` (boolean, default true) — show/hide the section.
    - `feature_banner_desktop_url` (text, nullable) — wide image for desktop.
    - `feature_banner_mobile_url` (text, nullable) — separate image for phones.
    - `feature_banner_link_url` (text, nullable) — optional click-through.

  2. Notes
    - One banner per store, no rotation. The section stays hidden until an image
      is uploaded, so existing stores are unaffected.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS feature_banner_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_banner_desktop_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feature_banner_mobile_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feature_banner_link_url text DEFAULT NULL;
