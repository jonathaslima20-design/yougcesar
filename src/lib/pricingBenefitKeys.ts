// Maps the literal PT-BR benefit strings in pricingPlans.ts to the stable i18next
// keys under the "pricing" namespace's "benefits"/"freePlan" objects, so the public
// funnel can show translated benefit copy without touching pricingPlans.ts itself
// (kept as-is, it's still the source of truth for the BR/BRL pricing display).
export const PAID_BENEFIT_KEYS: Record<string, string> = {
  'Produtos ilimitados': 'benefits.unlimited_products',
  'Categorias e tags ilimitadas': 'benefits.unlimited_categories',
  'Catálogo Digital via Link': 'benefits.digital_catalog',
  'Painel Administrativo completo': 'benefits.admin_panel',
  'Carrinho de compras': 'benefits.cart',
  'Controle de Estoque e Inventário': 'benefits.inventory',
  'Gestão de Pedidos e Vendas': 'benefits.orders',
  'Sistema de Cupons': 'benefits.coupons',
  'Personalização de cores e fontes': 'benefits.customization',
  'Integração com Meta Pixel e Google Tag': 'benefits.pixel_integration',
  'Programa de Indicação': 'benefits.referral',
  'Domínio próprio com SSL': 'benefits.custom_domain',
  'API REST para integrações externas (Bling, Tiny, ERPs)': 'benefits.rest_api',
  'Remoção da logomarca VitrineTurbo': 'benefits.no_branding',
};

export function translateBenefit(t: (key: string, options?: { defaultValue?: string }) => string, keyMap: Record<string, string>, text: string): string {
  const key = keyMap[text];
  return key ? t(key, { defaultValue: text }) : text;
}
