/*
  # Eletrônicos: cor do menu de categorias, independente do cabeçalho

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `nav_bg_color` — fundo da barra de categorias (desktop), antes presa à
      mesma cor do cabeçalho/rodapé (`header_bg_color`)
    - `nav_text_color` — texto/ícones dessa mesma barra

  Defaults match the header's own defaults, so nothing changes visually for
  stores that never touch this until they open "Personalizar Eletrônicos".
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS nav_bg_color text NOT NULL DEFAULT '#171717';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS nav_text_color text NOT NULL DEFAULT '#ffffff';
