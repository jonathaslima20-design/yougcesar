/*
  # Eletrônicos: cor de fundo e cor de texto por seção de conteúdo

  1. Changes to storefront_appearance (all "eletronicos"-only, ignored by "padrao")
    - `banners_bg_color` / `banners_text_color` — carrossel de banners
    - `benefits_bg_color` / `benefits_text_color` — barra de benefícios
    - `category_showcase_bg_color` / `category_showcase_text_color` — "Navegue por Categorias"
    - `mini_banners_bg_color` / `mini_banners_text_color` — grade de mini banners
    - `new_arrivals_bg_color` / `new_arrivals_text_color` — carrossel "Novidades"

  All default to white background / near-black text, matching how these
  sections already render today (no visual change until a merchant opens
  "Personalizar Eletrônicos" and picks something else).
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS banners_bg_color text NOT NULL DEFAULT '#ffffff';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS banners_text_color text NOT NULL DEFAULT '#0a0a0a';

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS benefits_bg_color text NOT NULL DEFAULT '#ffffff';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS benefits_text_color text NOT NULL DEFAULT '#0a0a0a';

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS category_showcase_bg_color text NOT NULL DEFAULT '#ffffff';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS category_showcase_text_color text NOT NULL DEFAULT '#0a0a0a';

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS mini_banners_bg_color text NOT NULL DEFAULT '#ffffff';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS mini_banners_text_color text NOT NULL DEFAULT '#0a0a0a';

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS new_arrivals_bg_color text NOT NULL DEFAULT '#ffffff';
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS new_arrivals_text_color text NOT NULL DEFAULT '#0a0a0a';
