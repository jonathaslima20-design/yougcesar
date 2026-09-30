/*
  # Eletrônicos: nova seção "Destaques" (abaixo dos Mini banners)

  1. Changes to products
    - `storefront_highlight` (boolean, default false) — merchant-toggled flag,
      same model as `storefront_featured` (Novidades) and `storefront_offer`
      (Ofertas): which products show in the new "Destaques" carousel.

  2. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `highlights_bg_color` / `highlights_text_color` — background/text color
      for the "Destaques" section, same pattern as the other content sections.
      Defaults to white background / near-black text (no visual change until
      a merchant opens "Personalizar Eletrônicos" and picks something else).
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_highlight boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_storefront_highlight_idx
  ON products (user_id, storefront_highlight)
  WHERE storefront_highlight = true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS highlights_bg_color text NOT NULL DEFAULT '#ffffff';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS highlights_text_color text NOT NULL DEFAULT '#0a0a0a';
