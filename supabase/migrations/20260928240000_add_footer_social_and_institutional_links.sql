/*
  # Rodapé Eletrônicos: logo própria, links institucionais e redes sociais

  1. Changes to users
    - `facebook_url`, `x_url`, `youtube_url`, `pinterest_url`, `linkedin_url`,
      `tiktok_url` — perfis sociais do lojista (Instagram e WhatsApp já
      existiam). Cada ícone só aparece no rodapé se o campo estiver preenchido.

  2. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `footer_logo_url` — logo própria exibida no rodapé, independente da logo
      do cabeçalho (`header_logo_url`); se vazio, cai no nome da loja como
      texto, igual já fazia antes.
    - `footer_institutional_links` — lista de links (nome + URL) cadastrados
      pelo lojista para a coluna "Institucional" do rodapé (ex: Sobre Nós,
      Trocas e devoluções...). Array vazio por padrão = coluna não aparece.
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS x_url text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pinterest_url text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tiktok_url text;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_logo_url text;
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_institutional_links jsonb NOT NULL DEFAULT '[]'::jsonb;
