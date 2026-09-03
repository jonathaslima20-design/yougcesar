export type PublicCurrency = 'MXN' | 'CLP' | 'EUR' | 'USD';

interface CurrencyAmounts {
  monthly: number;
  annual: number;
  zeroDecimal?: boolean;
}

// Mirrors scripts/setup-stripe-products.js's PLANS — keep these in sync with
// whatever's actually live in Stripe (pasted into /admin/stripe as stripe_prices).
// Only 2 cycles internationally (monthly/annual), unlike BR's 3-tier
// mensal/semestral/anual in src/lib/pricingPlans.ts (which stays untouched).
export const PUBLIC_PRICING_BY_CURRENCY: Record<PublicCurrency, CurrencyAmounts> = {
  MXN: { monthly: 199.0, annual: 1199.0 },
  CLP: { monthly: 9990, annual: 59990, zeroDecimal: true },
  EUR: { monthly: 12.99, annual: 79.0 },
  USD: { monthly: 14.99, annual: 89.0 },
};

const CURRENCY_FORMAT_LOCALE: Record<PublicCurrency, string> = {
  MXN: 'es-MX',
  CLP: 'es-CL',
  EUR: 'es-ES',
  USD: 'en-US',
};

export function formatPublicPrice(amount: number, currency: PublicCurrency): string {
  const { zeroDecimal } = PUBLIC_PRICING_BY_CURRENCY[currency];
  return new Intl.NumberFormat(CURRENCY_FORMAT_LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(amount);
}

export function annualMonthlyEquivalent(currency: PublicCurrency): number {
  return PUBLIC_PRICING_BY_CURRENCY[currency].annual / 12;
}

/** Rounded % saved by paying annually vs. 12x the monthly price. */
export function annualSavingsPercent(currency: PublicCurrency): number {
  const { monthly, annual } = PUBLIC_PRICING_BY_CURRENCY[currency];
  return Math.round((1 - annual / (monthly * 12)) * 100);
}
