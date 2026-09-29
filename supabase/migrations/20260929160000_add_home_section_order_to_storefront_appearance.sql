/*
  # Eletrônicos: ordem das seções da home

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `home_section_order` (text[], nullable) — ids of the movable home sections
      in the order the merchant wants them (banners, benefits, categories,
      offers, feature_banner, mini_banners, new_arrivals).

  2. Notes
    - NULL means "use the default order" (same order the page had before this
      column existed), so existing stores are unaffected. Ids missing from the
      array (e.g. a section added later) are appended by the app; unknown ids
      are ignored.
    - Top bar, header and footer are fixed and never part of this list.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS home_section_order text[] DEFAULT NULL;
