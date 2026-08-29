import type { BillingCurrency } from './provider';

export type BillingCycle = 'monthly' | 'annual';

export type StripeCurrency = Exclude<BillingCurrency, 'BRL'>;

/**
 * Nome da variável de ambiente (Supabase Edge Function secret) que guarda o
 * Price ID da Stripe para essa moeda/ciclo. O valor real só existe no
 * servidor (supabase/functions/stripe-checkout) — este módulo só sabe os
 * nomes, nunca lê nem expõe o Price ID em si no browser.
 */
export function getStripePriceEnvVar(currency: StripeCurrency, cycle: BillingCycle): string {
  return `STRIPE_PRICE_${currency}_${cycle.toUpperCase()}`;
}

export const STRIPE_CURRENCIES: StripeCurrency[] = ['MXN', 'CLP', 'EUR', 'USD'];
export const STRIPE_CYCLES: BillingCycle[] = ['monthly', 'annual'];
