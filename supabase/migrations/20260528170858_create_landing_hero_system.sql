/*
  # Landing Hero Dynamic Mockup System

  1. New Tables
    - `landing_hero_config` (singleton, id=1)
      - `animation_type` (text) - transition type between mockups: slide, fade, scale
      - `slide_interval_ms` (integer) - autoplay interval in milliseconds
      - `mockup_shadow` (text) - shadow level: none, sm, md, lg, xl
      - `mockup_scale` (numeric) - relative scale of phone frames
      - `mockup_gap` (integer) - gap between mockups in px
      - `autoplay` (boolean) - whether carousel auto-rotates
      - `pause_on_hover` (boolean) - pause autoplay on hover
      - `updated_at` (timestamptz)

    - `landing_hero_screens`
      - `id` (uuid, PK)
      - `display_order` (integer) - position in carousel
      - `is_active` (boolean) - visibility toggle
      - `label` (text) - display name
      - `screen_type` (text) - storefront, product_detail, dashboard, my_products, custom
      - `config` (jsonb) - full screen configuration data
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Public SELECT for both (landing page is public)
    - INSERT/UPDATE/DELETE restricted to admin users only

  3. Seed Data
    - Default hero config (singleton row)
    - 4 default screens: storefront, product_detail, dashboard, my_products
*/

-- Landing Hero Config (singleton)
CREATE TABLE IF NOT EXISTS landing_hero_config (
  id integer PRIMARY KEY DEFAULT 1,
  animation_type text NOT NULL DEFAULT 'slide',
  slide_interval_ms integer NOT NULL DEFAULT 5000,
  mockup_shadow text NOT NULL DEFAULT 'lg',
  mockup_scale numeric NOT NULL DEFAULT 1.0,
  mockup_gap integer NOT NULL DEFAULT 40,
  autoplay boolean NOT NULL DEFAULT true,
  pause_on_hover boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT singleton_config CHECK (id = 1),
  CONSTRAINT valid_animation_type CHECK (animation_type IN ('slide', 'fade', 'scale')),
  CONSTRAINT valid_mockup_shadow CHECK (mockup_shadow IN ('none', 'sm', 'md', 'lg', 'xl')),
  CONSTRAINT valid_scale_range CHECK (mockup_scale >= 0.5 AND mockup_scale <= 2.0),
  CONSTRAINT valid_interval CHECK (slide_interval_ms >= 1000 AND slide_interval_ms <= 30000)
);

ALTER TABLE landing_hero_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read hero config"
  ON landing_hero_config
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

CREATE POLICY "Admins can insert hero config"
  ON landing_hero_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update hero config"
  ON landing_hero_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Landing Hero Screens
CREATE TABLE IF NOT EXISTS landing_hero_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  label text NOT NULL DEFAULT '',
  screen_type text NOT NULL DEFAULT 'storefront',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_screen_type CHECK (screen_type IN ('storefront', 'product_detail', 'dashboard', 'my_products', 'custom'))
);

ALTER TABLE landing_hero_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active hero screens"
  ON landing_hero_screens
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert hero screens"
  ON landing_hero_screens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update hero screens"
  ON landing_hero_screens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete hero screens"
  ON landing_hero_screens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Seed default config
INSERT INTO landing_hero_config (id, animation_type, slide_interval_ms, mockup_shadow, mockup_scale, mockup_gap, autoplay, pause_on_hover)
VALUES (1, 'slide', 5000, 'lg', 1.0, 40, true, true)
ON CONFLICT (id) DO NOTHING;

-- Seed default screens
INSERT INTO landing_hero_screens (display_order, is_active, label, screen_type, config) VALUES
(1, true, 'Vitrine personalizada', 'storefront', '{
  "cover_url": "",
  "avatar_url": "",
  "store_name": "Minha Loja",
  "bio": "Os melhores produtos com os melhores precos",
  "social_buttons": ["cart", "whatsapp", "instagram"],
  "bg_color": "#ffffff",
  "text_color": "#0a0a0a",
  "accent_color": "#0f172a",
  "category_name": "Destaques",
  "products": [
    {"title": "Tenis Esportivo Premium", "image_url": "", "price": 299.90, "discount_price": 199.90},
    {"title": "Camiseta Casual", "image_url": "", "price": 89.90, "discount_price": null},
    {"title": "Relogio Digital", "image_url": "", "price": 450.00, "discount_price": 359.90},
    {"title": "Mochila Urbana", "image_url": "", "price": 159.90, "discount_price": null}
  ]
}'::jsonb),
(2, true, 'Detalhes do produto', 'product_detail', '{
  "product_image_url": "",
  "product_title": "Tenis Esportivo Premium",
  "product_description": "Conforto e estilo para o seu dia a dia",
  "price": 299.90,
  "discount_price": 199.90,
  "discount_badge": "-33%",
  "color_options": ["#000000", "#ffffff", "#1e40af", "#dc2626"],
  "size_options": ["38", "39", "40", "41", "42"],
  "button_text": "Adicionar ao Carrinho",
  "button_color": "#0f172a",
  "seller_avatar_url": "",
  "seller_name": "Loja Premium"
}'::jsonb),
(3, true, 'Dashboard', 'dashboard', '{
  "user_name": "João",
  "period_label": "Últimos 30 dias",
  "accent_color": "#0f172a",
  "stats": [
    {"label": "Produtos", "value": "48", "icon_name": "Package"},
    {"label": "Visualizações", "value": "1.2k", "icon_name": "TrendingUp"},
    {"label": "Visitantes", "value": "384", "icon_name": "Users"},
    {"label": "Conversões", "value": "27", "icon_name": "DollarSign"}
  ]
}'::jsonb),
(4, true, 'Meus Produtos', 'my_products', '{
  "page_title": "Meus Produtos",
  "product_count": 48,
  "view_mode": "grid",
  "products": [
    {"title": "Tenis Esportivo", "image_url": "", "price": 299.90, "views_count": 142, "status": "visible", "stock_qty": 12},
    {"title": "Camiseta Casual", "image_url": "", "price": 89.90, "views_count": 98, "status": "visible", "stock_qty": 25},
    {"title": "Relogio Digital", "image_url": "", "price": 450.00, "views_count": 67, "status": "hidden", "stock_qty": 3},
    {"title": "Mochila Urbana", "image_url": "", "price": 159.90, "views_count": 203, "status": "visible", "stock_qty": 8},
    {"title": "Bone Streetwear", "image_url": "", "price": 69.90, "views_count": 55, "status": "visible", "stock_qty": 30},
    {"title": "Jaqueta Corta-Vento", "image_url": "", "price": 349.90, "views_count": 31, "status": "visible", "stock_qty": 5}
  ]
}'::jsonb);
