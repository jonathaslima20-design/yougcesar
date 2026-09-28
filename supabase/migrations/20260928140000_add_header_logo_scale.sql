/*
  # Add header_logo_scale to storefront_appearance

  1. Changes
    - Add `header_logo_scale` (int, percentage, default 100) to `storefront_appearance`
    - Only consumed by the "eletronicos" theme's header (CorretorHeaderEletronicos),
      to resize the store logo shown there. Ignored by "padrao".

  2. Notes
    - 100 = the theme's original fixed logo size (44px mobile / 64px desktop),
      so every existing row keeps today's look until a merchant adjusts it.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS header_logo_scale int NOT NULL DEFAULT 100;

ALTER TABLE storefront_appearance
  ADD CONSTRAINT storefront_appearance_header_logo_scale_check
  CHECK (header_logo_scale BETWEEN 50 AND 200);
