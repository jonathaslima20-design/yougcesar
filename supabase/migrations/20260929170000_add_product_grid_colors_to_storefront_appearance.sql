/*
  # Eletrônicos: cores da grade de produtos

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `grid_card_bg_color`, `grid_card_border_color` — card background / border.
    - `grid_title_color`, `grid_price_color` — product name and price text.
    - `grid_button_bg_color`, `grid_button_text_color` — the "Adicionar" button.
    - `grid_badge_bg_color` — the discount badge.
    - `grid_section_bg_color` — background behind the product grid area.

  2. Notes
    - All nullable. NULL means "keep the theme's current look", so existing stores are
      unaffected until a merchant picks a color.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS grid_card_bg_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grid_card_border_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grid_title_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grid_price_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grid_button_bg_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grid_button_text_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grid_badge_bg_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grid_section_bg_color text DEFAULT NULL;
