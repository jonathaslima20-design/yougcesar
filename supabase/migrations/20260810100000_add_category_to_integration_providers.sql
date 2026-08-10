/*
  # Categoria em integration_providers (ERP vs Frete)

  1. Problema
    - `integration_providers` ja serve os cards de ERP na aba Integracoes
      (Olist), com logo configuravel pelo admin. A aba Frete hoje e so um
      formulario direto de credenciais da SuperFrete, sem esse padrao de
      card — mesmo a tabela ja sendo generica o suficiente pra guardar
      qualquer tipo de integracao.

  2. Fix
    - `category` diferencia os grupos ('erp' vira o padrao, cobrindo a
      linha existente do Olist sem UPDATE separado; 'shipping' pros
      provedores de frete).
    - Semeia a linha da SuperFrete ja como `is_enabled = true` — diferente
      do Olist (que nasceu desligado): SuperFrete ja e uma integracao real
      que lojistas usam hoje, entao nascer desligada esvaziaria a aba Frete
      ate um admin lembrar de habilitar.
*/

ALTER TABLE integration_providers
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'erp'
    CHECK (category IN ('erp', 'shipping'));

INSERT INTO integration_providers (slug, name, description, category, is_enabled, sort_order)
VALUES ('superfrete', 'SuperFrete', 'Cálculo de frete automático (Correios)', 'shipping', true, 0)
ON CONFLICT (slug) DO NOTHING;
