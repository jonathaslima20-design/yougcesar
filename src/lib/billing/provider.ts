export type BillingProvider = 'mercadopago' | 'stripe';
export type BillingCurrency = 'BRL' | 'MXN' | 'CLP' | 'EUR' | 'USD';

const COUNTRY_CURRENCY: Record<string, BillingCurrency> = {
  BR: 'BRL',
  MX: 'MXN',
  CL: 'CLP',
  ES: 'EUR',
  PT: 'EUR',
  US: 'USD',
};

export interface ProviderResolution {
  provider: BillingProvider;
  currency: BillingCurrency;
}

/**
 * Regra de ouro: BR sempre paga via Mercado Pago. Todo o resto paga via
 * Stripe, na moeda do país (ou USD como fallback para países fora da lista
 * de lançamento) — nunca bloqueia a venda por falta de moeda dedicada.
 */
export function getProviderForCountry(country: string | null | undefined): ProviderResolution {
  const normalized = (country || 'BR').toUpperCase();

  if (normalized === 'BR') {
    return { provider: 'mercadopago', currency: 'BRL' };
  }

  return { provider: 'stripe', currency: COUNTRY_CURRENCY[normalized] ?? 'USD' };
}
