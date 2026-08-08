/*
  # Add olist_product_id to products

  1. Modified Tables
    - `products`
      - `olist_product_id` (text, nullable) - the `idProduto` of the linked product in the
        merchant's Olist ERP account. Null means the product has never been linked to Olist.
        This is the join key used by merchant-erp-sync for both stock pull (GET
        /estoque/{idProduto}) and product push (PUT /produtos/{idProduto}).

  2. Notes
    - Text, not integer/uuid: Olist's idProduto is a large integer but there is no reason to
      constrain the column type to it specifically, and text avoids any future cross-provider
      friction if a second ERP is added.
    - No uniqueness constraint: two VitrineTurbo products are not expected to point at the
      same Olist product, but nothing downstream depends on that invariant being
      DB-enforced, and a merchant mid-relinking could transiently duplicate it.
    - Indexed because merchant-erp-sync's stock-pull job filters
      `WHERE user_id = $1 AND olist_product_id IS NOT NULL` for every sync run.
*/

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS olist_product_id text;

CREATE INDEX IF NOT EXISTS idx_products_olist_product_id
  ON public.products (user_id, olist_product_id)
  WHERE olist_product_id IS NOT NULL;
