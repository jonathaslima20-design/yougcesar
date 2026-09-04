export interface PricingPlan {
  id: string;
  tag: string;
  name: string;
  priceSuffix: string;
  priceUnit?: string;
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
    priceSuffix: '229,00',
    priceUnit: '/semestre',
    billedNote: 'Cobrado a cada 6 meses',
    savingsBadge: 'Economize 33%',
    benefits: allPaidBenefits,
  },
  {
    id: 'anual',
    tag: 'Recomendado',
    name: 'Anual',
    priceSuffix: '336,00',
    priceUnit: '/ano',
    billedNote: 'Cobrado uma vez por ano',
    savingsBadge: 'Economize 51%',
    featured: true,
    benefits: anualBenefits,
  },
];
