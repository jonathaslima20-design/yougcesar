/*
  # Remove politicas duplicadas de product_price_tiers (timeout apos RLS)

  1. Problema
    - Apos a migracao anterior (20260809100000) ligar RLS em `products` e
      `product_price_tiers`, salvar um produto com precos por atacado passou
      a dar "erro ao atualizar produto" — o DELETE em
      `product_price_tiers WHERE product_id = X` estoura em
      "canceling statement due to statement timeout" (57014).
    - `product_price_tiers` tinha 2 politicas identicas para cada operacao
      (INSERT/UPDATE/DELETE/SELECT), cada uma fazendo seu proprio
      `EXISTS (SELECT 1 FROM products WHERE ...)`. Como `products` agora
      tambem tem RLS com 4 politicas de leitura (uma delas com outro EXISTS
      aninhado em `users`), o Postgres reavalia essa cadeia inteira DUAS
      VEZES por linha (uma por politica duplicada) em vez de uma. Duplicar
      esse custo pode ter sido o que empurrou a consulta pro timeout.

  2. Fix
    - Mantem so uma politica por operacao (a variante "...for
      their/own products" com o texto mais claro), removendo a duplicata.
    - Nao mexe na logica de nenhuma politica — so remove a redundancia.
*/

DROP POLICY IF EXISTS "Users can insert price tiers for own products" ON product_price_tiers;
DROP POLICY IF EXISTS "Users can delete price tiers of own products" ON product_price_tiers;
DROP POLICY IF EXISTS "Users can update price tiers of own products" ON product_price_tiers;
DROP POLICY IF EXISTS "Users can view price tiers of own products" ON product_price_tiers;
DROP POLICY IF EXISTS "Anonymous users can view price tiers of visible products" ON product_price_tiers;
