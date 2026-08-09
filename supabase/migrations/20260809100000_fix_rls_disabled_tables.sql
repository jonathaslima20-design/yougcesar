/*
  # Corrige tabelas com RLS desligado (vulnerabilidade critica)

  1. Problema
    - Auditoria (2026-08-09) encontrou 11 tabelas em public com politicas de
      RLS cadastradas mas RLS DESLIGADO na tabela (`relrowsecurity = false`).
      Quando RLS esta desligado, o Postgres ignora TODAS as politicas —
      qualquer requisicao com a anon key (publica, embutida no bundle do
      site) tem acesso total de leitura/escrita/exclusao, independente do
      que as politicas dizem.
    - Confirmado na pratica: um DELETE anonimo em `products` (ja corrigida
      antes desta migracao) removeu um produto real sem nenhuma autenticacao.
    - Tabelas afetadas nesta migracao: leads, property_views,
      tracking_settings, user_product_categories, user_storefront_settings,
      product_images, site_settings, product_price_tiers,
      product_dynamic_field_values, user_image_settings.

  2. Achado extra em product_price_tiers
    - Alem do RLS desligado, a tabela tem 3 politicas soltas SEM checagem de
      dono: "Product owners can create/delete/update price tiers", com
      `USING`/`WITH CHECK` literalmente `true` — permitiam mexer no preco de
      QUALQUER produto de QUALQUER loja. Como politicas RLS se somam (OR),
      só ligar RLS nao bastava: essas continuariam liberando tudo. Removidas
      aqui; as politicas "...for own/their products" (com checagem real via
      `products.user_id = auth.uid()`) ja cobrem os mesmos casos de uso.

  3. Achado extra em user_storefront_settings
    - So existia 1 politica (dono via `user_id = auth.uid()`), mas essa
      tabela e lida SEM login pelo checkout do comprador
      (`useCheckoutSettingsForStore`/`useInventoryEnabled`, por
      `storeOwnerId`) — ligar RLS sem adicionar leitura publica quebraria o
      checkout de toda loja. Politica nova adicionada, no mesmo padrao ja
      usado em `products` (loja nao bloqueada).
*/

-- Remove as 3 politicas de product_price_tiers sem checagem de dono real.
DROP POLICY IF EXISTS "Product owners can create price tiers" ON product_price_tiers;
DROP POLICY IF EXISTS "Product owners can delete price tiers" ON product_price_tiers;
DROP POLICY IF EXISTS "Product owners can update price tiers" ON product_price_tiers;

-- Leitura publica que faltava para o checkout do comprador funcionar.
CREATE POLICY "Public can view storefront settings"
  ON user_storefront_settings
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = user_storefront_settings.user_id
        AND NOT users.is_blocked
    )
  );

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_storefront_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_dynamic_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_image_settings ENABLE ROW LEVEL SECURITY;
