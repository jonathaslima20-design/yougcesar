export interface PricingPlan {
  id: string;
  tag: string;
  name: string;
  priceSuffix: string;
  billedNote: string;
  savingsBadge?: string;
  featured?: boolean;
  benefits: string[];
}

const allPaidBenefits = [
  'Produtos ilimitados',
  'Categorias e tags ilimitadas',
  'Catálogo Digital via Link',
  'Painel Administrativo completo',
  'Carrinho de compras',
  'Controle de Estoque e Inventário',
  'Gestão de Pedidos e Vendas',
  'Sistema de Cupons',
  'Personalização de cores e fontes',
  'Integração com Meta Pixel e Google Tag',
  'Programa de Indicação',
  'Domínio próprio com SSL',
];

const anualBenefits = [
  ...allPaidBenefits,
  'API REST para integrações externas (Bling, Tiny, ERPs)',
  'Remoção da logomarca VitrineTurbo',
];

export const PAID_PLANS: PricingPlan[] = [
  {
    id: 'mensal',
    tag: 'Flexível',
    name: 'Mensal',
    priceSuffix: '57,00',
    billedNote: 'Cobrado mensalmente',
    benefits: allPaidBenefits,
  },
  {
    id: 'semestral',
    tag: 'Mais escolhido',
    name: 'Semestral',
    priceSuffix: '38,17',
    billedNote: 'R$ 229 a cada 6 meses',
    savingsBadge: 'Economize 33%',
    benefits: allPaidBenefits,
  },
  {
    id: 'anual',
    tag: 'Recomendado',
    name: 'Anual',
    priceSuffix: '28,00',
    billedNote: 'R$ 336 cobrados por ano',
    savingsBadge: 'Economize 51%',
    featured: true,
    benefits: anualBenefits,
  },
];

export const FREE_PLAN_BENEFITS_INCLUDED = [
  'Até 20 produtos',
  'Catálogo Digital via Link',
  'Suporte Humanizado',
];

export const FREE_PLAN_BENEFITS_EXCLUDED = [
  'Domínio próprio',
  'Personalização de cores',
  'Analytics avançado',
  'Cupons de desconto',
  'Produtos ilimitados',
];
