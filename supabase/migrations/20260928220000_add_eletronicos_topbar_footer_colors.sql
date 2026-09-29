/*
  # Eletrônicos: cor própria para a barra de frases do topo e para o rodapé

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `topbar_bg_color` / `topbar_text_color` — a faixa de frases no topo da
      página, antes presa à mesma cor do cabeçalho (`header_bg_color`)
    - `footer_bg_color` / `footer_text_color` — o rodapé, também antes preso
      à cor do cabeçalho

  Defaults match the header's own defaults, so nothing changes visually for
  stores that never touch this until they open "Personalizar Eletrônicos".
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS topbar_bg_color text NOT NULL DEFAULT '#171717';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS topbar_text_color text NOT NULL DEFAULT '#ffffff';

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_bg_color text NOT NULL DEFAULT '#171717';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_text_color text NOT NULL DEFAULT '#ffffff';
