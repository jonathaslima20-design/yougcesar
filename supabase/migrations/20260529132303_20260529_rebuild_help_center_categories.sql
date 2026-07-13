/*
  # Rebuild Help Center - New Category Structure

  Replaces the 6 existing categories with 9 new ones organized around the
  user's natural journey through the VitrineTurbo platform.

  ## Changes
  - Deletes all existing help articles and categories
  - Inserts 9 new categories covering the full user journey
*/

DELETE FROM help_article_feedback;
DELETE FROM help_article_views;
DELETE FROM help_articles;
DELETE FROM help_categories;

INSERT INTO help_categories (name, slug, description, icon, display_order, is_active) VALUES
  ('Primeiros Passos', 'primeiros-passos', 'Tudo que você precisa para começar do zero e configurar sua vitrine digital com sucesso.', 'Rocket', 1, true),
  ('Vitrine & Produtos', 'vitrine-produtos', 'Como cadastrar produtos, criar categorias, gerenciar imagens, variações e personalizar o visual da sua loja.', 'Package', 2, true),
  ('Pedidos & Vendas', 'pedidos-vendas', 'Acompanhe pedidos, entenda o funil de vendas e gerencie o checkout da sua loja.', 'ShoppingCart', 3, true),
  ('Cupons & Promoções', 'cupons-promocoes', 'Crie cupons de desconto, defina regras de promoção e monitore o desempenho das campanhas.', 'Gift', 4, true),
  ('Controle de Estoque', 'controle-estoque', 'Ative o controle de estoque, registre entradas e saídas e fique de olho nos produtos críticos.', 'BarChart2', 5, true),
  ('Financeiro & Planos', 'financeiro-planos', 'Entenda os planos do VitrineTurbo, configure pagamentos via MercadoPago e gerencie cobranças.', 'CreditCard', 6, true),
  ('Programa de Indicações', 'indicacoes', 'Ganhe comissões indicando amigos para o VitrineTurbo, configure sua chave PIX e solicite saques.', 'Users', 7, true),
  ('Integrações & API', 'integracoes-api', 'Conecte o Meta Pixel, Google Analytics e use a API pública do VitrineTurbo para integrações avançadas.', 'Zap', 8, true),
  ('Solução de Problemas', 'solucao-problemas', 'Resolva rapidamente os problemas mais comuns: login, produtos, pedidos e muito mais.', 'AlertCircle', 9, true);
