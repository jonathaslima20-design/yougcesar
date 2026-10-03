/*
  # E-commerce: títulos editáveis das seções Ofertas, Novidades e Destaques

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `offers_title` (text, nullable) — título do carrossel "Ofertas".
    - `new_arrivals_title` (text, nullable) — título do carrossel "Novidades".
    - `highlights_title` (text, nullable) — título do carrossel "Destaques".

  2. Notes
    - null = a loja mostra o nome padrão da seção.
    - Aditivo e reversível — apenas colunas nulas, nada é migrado ou apagado.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS offers_title text DEFAULT NULL;
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS new_arrivals_title text DEFAULT NULL;
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS highlights_title text DEFAULT NULL;
