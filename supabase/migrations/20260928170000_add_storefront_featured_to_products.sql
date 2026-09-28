/*
  # Add storefront_featured to products

  1. Changes
    - Add `storefront_featured` (boolean, default false) to `products`.
    - Merchant-toggled flag: which products show in the "eletronicos" theme's
      "Novidades" carousel (below the product grid). Ignored by the "padrao" theme.

  2. Notes
    - Not tied to `created_at` — a manual curation flag, toggled from
      "Personalizar Eletrônicos" in the dashboard, not the product form.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_storefront_featured_idx
  ON products (user_id, storefront_featured)
  WHERE storefront_featured = true;
