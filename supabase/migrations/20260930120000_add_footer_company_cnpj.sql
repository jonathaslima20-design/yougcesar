/*
  # Rodapé Eletrônicos: nome da empresa e CNPJ

  1. Changes to storefront_appearance (eletronicos-only, ignored by "padrao")
    - `footer_company_name` — razão social/nome fantasia exibido no rodapé,
      abaixo da frase/tagline.
    - `footer_cnpj` — CNPJ formatado (00.000.000/0001-00), exibido junto ao
      nome da empresa. Ambos opcionais e independentes.
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_company_name text;
ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_cnpj text;
