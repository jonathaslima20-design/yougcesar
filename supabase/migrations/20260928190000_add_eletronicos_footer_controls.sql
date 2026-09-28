/*
  # Eletrônicos: footer column toggles, credit line toggle, custom tagline

  1. Changes to storefront_appearance (all "eletronicos"-only, ignored by "padrao")
    - `footer_categories_enabled` (boolean, default true) — "Categorias" column
    - `footer_contact_enabled` (boolean, default true) — "Atendimento" column
    - `footer_payment_enabled` (boolean, default true) — "Formas de pagamento" +
      "Selos de segurança" column (still additionally gated to BRL stores)
    - `footer_credit_enabled` (boolean, default true) — the small
      "{loja} — Catálogo online por VitrineTurbo" line at the very bottom
    - `footer_tagline` (text, nullable) — overrides the store bio shown under the
      store name in the footer; falls back to the profile bio when null
*/

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_categories_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_contact_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_payment_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_credit_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE storefront_appearance
  ADD COLUMN IF NOT EXISTS footer_tagline text DEFAULT NULL;
