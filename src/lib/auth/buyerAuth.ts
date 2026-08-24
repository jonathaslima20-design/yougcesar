import { supabaseBuyer } from '../supabaseBuyer';

export interface Customer {
  id: string;
  email: string;
  full_name: string;
  whatsapp: string | null;
  country_code: string;
  cpf: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

const STORAGE_KEYS = {
  CUSTOMER: 'vitrineturbo_buyer_user',
} as const;

function storeCustomer(customer: Customer): void {
  localStorage.setItem(STORAGE_KEYS.CUSTOMER, JSON.stringify(customer));
}

export function getStoredCustomer(): Customer | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOMER);
    return stored ? (JSON.parse(stored) as Customer) : null;
  } catch {
    return null;
  }
}

function clearStoredCustomer(): void {
  localStorage.removeItem(STORAGE_KEYS.CUSTOMER);
}

export async function registerBuyer(
  email: string,
  password: string,
  data: { full_name: string; whatsapp?: string; country_code?: string }
): Promise<{ customer: Customer | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } = await supabaseBuyer.auth.signUp({
    email: normalizedEmail,
    password,
  });

  if (authError) {
    if (authError.message?.includes('already registered') || authError.message?.includes('already in use')) {
      return { customer: null, error: 'Este e-mail já está cadastrado. Faça login.' };
    }
    return { customer: null, error: authError.message || 'Erro ao criar conta' };
  }

  if (!authData.user) {
    return { customer: null, error: 'Erro ao criar conta' };
  }

  const { data: customer, error: profileError } = await supabaseBuyer
    .from('customers')
    .upsert({
      id: authData.user.id,
      email: normalizedEmail,
      full_name: data.full_name,
      whatsapp: data.whatsapp || null,
      country_code: data.country_code || '55',
    })
    .select()
    .single();

  if (profileError || !customer) {
    return { customer: null, error: profileError?.message || 'Erro ao criar perfil de comprador' };
  }

  storeCustomer(customer);
  return { customer, error: null };
}

export async function authenticateBuyer(
  email: string,
  password: string
): Promise<{ customer: Customer | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } = await supabaseBuyer.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError) {
    if (authError.message?.includes('Invalid login credentials')) {
      return { customer: null, error: 'E-mail ou senha incorretos' };
    }
    return { customer: null, error: authError.message || 'Erro ao entrar' };
  }

  if (!authData.user) {
    return { customer: null, error: 'Erro ao entrar' };
  }

  const { data: customer, error: profileError } = await supabaseBuyer
    .from('customers')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !customer) {
    return { customer: null, error: 'Perfil de comprador não encontrado para esta conta' };
  }

  storeCustomer(customer);
  return { customer, error: null };
}

export async function updateBuyerProfile(
  customerId: string,
  data: { full_name: string; whatsapp?: string | null; country_code?: string; cpf?: string | null }
): Promise<{ customer: Customer | null; error: string | null }> {
  const { data: customer, error } = await supabaseBuyer
    .from('customers')
    .update({
      full_name: data.full_name,
      whatsapp: data.whatsapp || null,
      country_code: data.country_code || '55',
      ...(data.cpf !== undefined ? { cpf: data.cpf } : {}),
    })
    .eq('id', customerId)
    .select()
    .single();

  if (error || !customer) {
    return { customer: null, error: error?.message || 'Erro ao atualizar perfil' };
  }

  storeCustomer(customer);
  return { customer, error: null };
}

// Lighter-weight than updateBuyerProfile: the checkout page only has the
// CPF on hand (not the buyer's full profile), and saving it there is a
// best-effort convenience so the next purchase can skip asking again.
export async function updateBuyerCpf(customerId: string, cpf: string): Promise<Customer | null> {
  const { data: customer, error } = await supabaseBuyer
    .from('customers')
    .update({ cpf })
    .eq('id', customerId)
    .select()
    .single();

  if (error || !customer) return null;
  storeCustomer(customer);
  return customer;
}

export async function logoutBuyer(): Promise<void> {
  try {
    await supabaseBuyer.auth.signOut();
  } finally {
    clearStoredCustomer();
  }
}

// Start Google OAuth for the buyer client (separate from the merchant's
// signInWithGoogle in simpleAuth.ts, which redirects to /auth/callback and
// resolves against the `users` table instead of `customers`).
export async function signInWithGoogleBuyer(options?: {
  redirectTo?: string;
  storeSlug?: string;
}): Promise<{ error: string | null }> {
  try {
    const params = new URLSearchParams();
    if (options?.storeSlug) params.set('loja', options.storeSlug);
    if (options?.redirectTo) params.set('from', options.redirectTo);
    const query = params.toString();

    const { error } = await supabaseBuyer.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/conta/auth/callback${query ? `?${query}` : ''}`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error: any) {
    return { error: error.message || 'Erro ao iniciar login com Google' };
  }
}

// Completes the buyer's Google OAuth round-trip. `supabaseBuyer` has
// `detectSessionInUrl: false` (see supabaseBuyer.ts) so nothing auto-parses
// the `?code=` param on the callback route — this exchanges it explicitly.
// The `code` no longer lives in `window.location` by the time this runs:
// earlyBuyerOAuthCapture.ts (imported first in main.tsx, before any Supabase
// client exists) already stripped it and stashed the original URL, so the
// merchant `supabase` client's own auto-detection doesn't race for it.
export async function resolveBuyerOAuthCallback(): Promise<{ customer: Customer | null; error: string | null }> {
  const stashedUrl = sessionStorage.getItem('vitrineturbo_buyer_oauth_url');
  sessionStorage.removeItem('vitrineturbo_buyer_oauth_url');

  const callbackUrl = stashedUrl || window.location.href;
  const parsedParams = new URL(callbackUrl).searchParams;
  const oauthError = parsedParams.get('error_description') || parsedParams.get('error');
  if (oauthError) {
    return { customer: null, error: oauthError };
  }

  const { data, error: exchangeError } = await supabaseBuyer.auth.exchangeCodeForSession(callbackUrl);

  if (exchangeError || !data.session?.user) {
    return { customer: null, error: exchangeError?.message || 'Não foi possível concluir o login com Google' };
  }

  const authUser = data.session.user;
  const normalizedEmail = (authUser.email || '').trim().toLowerCase();
  const fullName =
    (authUser.user_metadata?.full_name as string | undefined) ||
    (authUser.user_metadata?.name as string | undefined) ||
    normalizedEmail;

  const { data: customer, error: upsertError } = await supabaseBuyer
    .from('customers')
    .upsert({
      id: authUser.id,
      email: normalizedEmail,
      full_name: fullName,
    })
    .select()
    .single();

  if (upsertError || !customer) {
    return { customer: null, error: upsertError?.message || 'Erro ao criar perfil de comprador' };
  }

  storeCustomer(customer);
  return { customer, error: null };
}

// Resolves whatever Supabase Auth session currently exists on the buyer
// client into a Customer profile. Supabase itself persists/refreshes the
// underlying token across reloads; this just re-syncs the local `customers`
// profile cache and lets the caller know if there's an active buyer session.
export async function resolveBuyerSession(): Promise<{ customer: Customer | null; error: string | null }> {
  const {
    data: { session },
  } = await supabaseBuyer.auth.getSession();

  if (!session?.user) {
    clearStoredCustomer();
    return { customer: null, error: null };
  }

  const { data: customer, error } = await supabaseBuyer
    .from('customers')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !customer) {
    clearStoredCustomer();
    return { customer: null, error: error?.message || null };
  }

  storeCustomer(customer);
  return { customer, error: null };
}
