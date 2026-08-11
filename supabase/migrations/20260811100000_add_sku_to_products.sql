/*
  # SKU em products para upsert de importação em massa

  1. Problema
    - A importação CSV avançada (variações + imagens) precisa reimportar o
      mesmo arquivo depois para atualizar preço/estoque sem duplicar
      produtos. Não existe hoje nenhuma coluna estável para casar uma linha
      do CSV com um produto já existente — título sozinho não serve (lojistas
      têm títulos repetidos/quase-iguais).

  2. Solução
    - Coluna `sku` opcional em `products`, texto livre definido pelo lojista.
    - Índice único parcial por (user_id, sku), ignorando linhas com sku nulo
      ou em branco — SKU em branco nunca colide e sempre resulta em criação
      de produto novo na importação.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_sku
  ON products (user_id, sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '';
