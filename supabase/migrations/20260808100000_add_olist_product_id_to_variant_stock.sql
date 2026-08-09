/*
  # Vinculo Olist por variante (cor/tamanho)

  1. Problema
    - `products.olist_product_id` (migracao 20260805110000) so permite UM
      vinculo por produto VitrineTurbo. Mas na Olist, cada combinacao de
      cor+tamanho e um produto/SKU proprio, com seu proprio id. Um produto
      com variantes (ex: "Camiseta" em Preto/M, Preto/G, Branco/M) precisa
      de ate 3 vinculos diferentes, um por combinacao — impossivel com uma
      unica coluna no produto.

  2. Fix
    - `olist_product_id` entra em `product_variant_stock`: cada linha de
      variante (que ja representa uma combinacao cor/tamanho/sabor) ganha
      seu proprio vinculo opcional.
    - `products.olist_product_id` continua existindo e sendo o caminho
      usado para produtos SEM variantes (estoque simples/flat) — nao muda.
    - Um mesmo id da Olist nao pode ser vinculado duas vezes dentro do
      mesmo produto (mesma trava logica que ja existe em `products` via
      uso da coluna), mas pode se repetir entre produtos diferentes so
      por seguranca do dado (nao ha essa garantia do lado da Olist).
*/

ALTER TABLE product_variant_stock
  ADD COLUMN IF NOT EXISTS olist_product_id text DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variant_stock_olist_product_id_per_product_idx
  ON product_variant_stock (product_id, olist_product_id)
  WHERE olist_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_variant_stock_olist_product_id_idx
  ON product_variant_stock (olist_product_id)
  WHERE olist_product_id IS NOT NULL;

-- merchant-erp-sync (edge function, service-role client) recalculates a
-- product's aggregate stock straight after pulling variant-level quantities
-- from the Olist, without going through the owner-checked "_my_" wrapper
-- (there's no auth.uid() under service role). The 20260807100000 migration
-- revoked this from PUBLIC/anon/authenticated; service_role needs its own
-- explicit grant to call it directly.
GRANT EXECUTE ON FUNCTION public.recalc_product_aggregate_stock(uuid) TO service_role;
