export type BillingProvider = 'mercadopago' | 'stripe' | 'cakto';
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

/**
 * Dentro do Brasil, um segundo nível de roteamento decide entre Mercado
 * Pago e Cakto — controlado inteiramente pelo toggle `cakto_config.is_active`
 * no admin (não pelo usuário). Falha ao consultar (Cakto não configurada,
 * erro de rede) sempre cai para Mercado Pago, que é o provedor estabelecido.
 */
export async function getActiveBrProvider(): Promise<'mercadopago' | 'cakto'> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return 'mercadopago';

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cakto`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'getPublicKey' }),
    });

    if (!resp.ok) return 'mercadopago';
    const data = await resp.json();
    return data?.sdk_client_id ? 'cakto' : 'mercadopago';
  } catch {
    return 'mercadopago';
  }
}
