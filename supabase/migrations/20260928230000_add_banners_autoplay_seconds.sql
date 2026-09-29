/*
  # Eletrônicos: tempo do carrossel de banners configurável

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `banners_autoplay_seconds` — segundos entre a troca automática de slides
      no carrossel de banners. Antes fixo em 5s no código.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS banners_autoplay_seconds smallint NOT NULL DEFAULT 5;
