/*
  # Ordem dos carrosséis "Ofertas", "Novidades" e "Destaques"

  1. Changes to products
    - `storefront_offer_order` (integer, nullable) — posição do produto dentro do
      carrossel "Ofertas", definida pelo lojista ao arrastar e soltar em
      "Personalizar Eletrônicos". Produtos sem posição definida (null) aparecem
      por último, ordenados pelos mais recentes primeiro.
    - `storefront_featured_order` (integer, nullable) — mesmo modelo, para "Novidades".
    - `storefront_highlight_order` (integer, nullable) — mesmo modelo, para "Destaques".

  2. Notes
    - Independente de `display_order` (usado no catálogo do painel e na vitrine
      "padrão"): um produto pode ocupar posições diferentes em cada carrossel.
    - Aditivo e reversível — apenas novas colunas nulas, nada é migrado ou apagado.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_offer_order integer;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_featured_order integer;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_highlight_order integer;
