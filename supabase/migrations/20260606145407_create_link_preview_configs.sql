/*
# Create link_preview_configs table

Stores configurable Open Graph / link preview metadata for different page types.
Admins can customize how links appear when shared on WhatsApp, Facebook, Twitter, etc.

1. New Tables
   - `link_preview_configs`
     - `id` (uuid, primary key)
     - `page_type` (text, unique) - identifies the page: landing, referral, help_center, corretor_default, product_default
     - `og_title` (text) - Open Graph title
     - `og_description` (text) - Open Graph description
     - `og_image_url` (text) - URL to the preview image
     - `og_site_name` (text) - Site name shown in previews
     - `og_type` (text) - Open Graph type (website, article, profile)
     - `twitter_card_type` (text) - Twitter card type (summary, summary_large_image)
     - `is_active` (boolean) - When false, falls back to hardcoded defaults
     - `placeholders_hint` (text) - Helper text showing available placeholders for this page type
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - RLS enabled
   - Public read (anon + authenticated) since edge functions need to read without auth context
   - Admin-only write via authenticated + role check

3. Seed Data
   - One row per supported page type with current hardcoded default values
*/

CREATE TABLE IF NOT EXISTS link_preview_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text UNIQUE NOT NULL,
  og_title text NOT NULL DEFAULT '',
  og_description text NOT NULL DEFAULT '',
  og_image_url text NOT NULL DEFAULT '',
  og_site_name text NOT NULL DEFAULT 'VitrineTurbo',
  og_type text NOT NULL DEFAULT 'website',
  twitter_card_type text NOT NULL DEFAULT 'summary_large_image',
  is_active boolean NOT NULL DEFAULT true,
  placeholders_hint text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE link_preview_configs ENABLE ROW LEVEL SECURITY;

-- Public read for edge functions (they use anon key or service role)
DROP POLICY IF EXISTS "public_read_link_preview_configs" ON link_preview_configs;
CREATE POLICY "public_read_link_preview_configs"
  ON link_preview_configs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin-only write (insert/update/delete restricted to authenticated users with admin role)
DROP POLICY IF EXISTS "admin_insert_link_preview_configs" ON link_preview_configs;
CREATE POLICY "admin_insert_link_preview_configs"
  ON link_preview_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_link_preview_configs" ON link_preview_configs;
CREATE POLICY "admin_update_link_preview_configs"
  ON link_preview_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_link_preview_configs" ON link_preview_configs;
CREATE POLICY "admin_delete_link_preview_configs"
  ON link_preview_configs FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Seed default configs for each page type
INSERT INTO link_preview_configs (page_type, og_title, og_description, og_image_url, og_site_name, og_type, twitter_card_type, is_active, placeholders_hint)
VALUES
  (
    'landing',
    'VitrineTurbo - Sua Vitrine Digital',
    'VitrineTurbo - Plataforma completa para criar sua vitrine digital profissional. Mostre seus produtos e receba pedidos pelo WhatsApp.',
    'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png',
    'VitrineTurbo',
    'website',
    'summary_large_image',
    true,
    NULL
  ),
  (
    'referral',
    '{nome_indicador} te convidou para o VitrineTurbo!',
    'Crie sua vitrine digital profissional com desconto exclusivo! Use o cupom {codigo} e ganhe 20% OFF no seu plano.',
    'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png',
    'VitrineTurbo',
    'website',
    'summary_large_image',
    true,
    'Placeholders disponiveis: {nome_indicador}, {codigo}'
  ),
  (
    'help_center',
    'Central de Ajuda - VitrineTurbo',
    'Encontre tutoriais, guias e respostas para suas duvidas sobre o VitrineTurbo. Suporte completo para sua vitrine digital.',
    'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png',
    'VitrineTurbo',
    'website',
    'summary',
    true,
    NULL
  ),
  (
    'corretor_default',
    '{nome_loja} - VitrineTurbo',
    'Confira os produtos de {nome_loja} no VitrineTurbo. Vitrine digital profissional com pedidos via WhatsApp.',
    '',
    'VitrineTurbo',
    'profile',
    'summary_large_image',
    true,
    'Placeholders disponiveis: {nome_loja}. Imagem: usa avatar do usuario se vazio.'
  ),
  (
    'product_default',
    '{nome_produto} - {nome_loja}',
    '{descricao_produto}',
    '',
    'VitrineTurbo',
    'product',
    'summary_large_image',
    true,
    'Placeholders disponiveis: {nome_produto}, {nome_loja}, {preco}, {descricao_produto}. Imagem: usa foto do produto se vazio.'
  )
ON CONFLICT (page_type) DO NOTHING;
