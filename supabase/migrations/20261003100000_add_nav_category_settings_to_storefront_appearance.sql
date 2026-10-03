/*
  # Eletrônicos: categorias exibidas no menu (independente da Vitrine)

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `nav_category_settings` (jsonb, nullable) — lista de `{category, order, enabled}`
      definida pelo lojista em "Personalizar Eletrônicos → Categorias do menu".
      Controla só a barra "Todas Categorias" e o drawer do menu, sem mexer na
      "Organização por Categorias" da Vitrine.

  2. Notes
    - null = o menu segue a organização da Vitrine (comportamento atual, nada muda).
    - Aditivo e reversível — apenas uma coluna nula, nada é migrado ou apagado.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS nav_category_settings jsonb DEFAULT NULL;
