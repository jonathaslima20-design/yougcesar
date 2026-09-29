/*
  # Add storefront_offer to products

  1. Changes
    - Add `storefront_offer` (boolean, default false) to `products`.
    - Merchant-toggled flag: which products show in the "eletronicos" theme's
      "Ofertas" carousel (home, below "Navegue por Categorias"). Ignored by the
      "padrao" theme.

  2. Notes
    - Manual curation, same model as `storefront_featured` (Novidades). Replaces
      the earlier automatic "any product with discounted_price" rule.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_offer boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_storefront_offer_idx
  ON products (user_id, storefront_offer)
  WHERE storefront_offer = true;
