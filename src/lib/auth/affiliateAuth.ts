import { supabaseAffiliate } from '../supabaseAffiliate';

export interface AffiliateProfile {
  id: string;
  store_owner_id: string;
  email: string;
  name: string;
  whatsapp: string | null;
  country_code: string;
  affiliate_code: string;
  default_commission_percentage: number;
  commission_trigger: 'confirmed' | 'delivered';
  attribution_window_days: 7 | 15 | 30;
  payment_frequency: 'weekly' | 'biweekly' | 'monthly';
  whatsapp_contact_mode: 'store_default' | 'own_whatsapp';
  pix_key: string | null;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null;
  pix_holder_name: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

const STORAGE_KEY = 'vitrineturbo_affiliate_user';

function storeAffiliate(affiliate: AffiliateProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(affiliate));
}

export function getStoredAffiliate(): AffiliateProfile | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AffiliateProfile) : null;
  } catch {
    return null;
  }
}

function clearStoredAffiliate(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// No self-registration: affiliate accounts are created by the store owner
// (create-affiliate edge function). This module only handles login/session.
export async function authenticateAffiliate(
  email: string,
  password: string
): Promise<{ affiliate: AffiliateProfile | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: authData, error: authError } = await supabaseAffiliate.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError) {
    if (authError.message?.includes('Invalid login credentials')) {
      return { affiliate: null, error: 'E-mail ou senha incorretos' };
    }
    return { affiliate: null, error: authError.message || 'Erro ao entrar' };
  }

  if (!authData.user) {
    return { affiliate: null, error: 'Erro ao entrar' };
  }

  const { data: affiliate, error: profileError } = await supabaseAffiliate
    .from('affiliates')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !affiliate) {
    await supabaseAffiliate.auth.signOut();
    return { affiliate: null, error: 'Esta conta não é uma conta de afiliado' };
  }

  storeAffiliate(affiliate);
  return { affiliate, error: null };
}

export async function updateAffiliateProfile(
  affiliateId: string,
  data: {
    name: string;
    whatsapp?: string | null;
    pix_key?: string | null;
    pix_key_type?: AffiliateProfile['pix_key_type'];
    pix_holder_name?: string | null;
  }
): Promise<{ affiliate: AffiliateProfile | null; error: string | null }> {
  const { data: affiliate, error } = await supabaseAffiliate
    .from('affiliates')
    .update({
      name: data.name,
      whatsapp: data.whatsapp || null,
      pix_key: data.pix_key || null,
      pix_key_type: data.pix_key_type || null,
      pix_holder_name: data.pix_holder_name || null,
    })
    .eq('id', affiliateId)
    .select()
    .single();

  if (error || !affiliate) {
    return { affiliate: null, error: error?.message || 'Erro ao atualizar perfil' };
  }

  storeAffiliate(affiliate);
  return { affiliate, error: null };
}

export async function changeAffiliatePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabaseAffiliate.auth.updateUser({ password: newPassword });
  return { error: error?.message || null };
}

export async function logoutAffiliate(): Promise<void> {
  try {
    await supabaseAffiliate.auth.signOut();
  } finally {
    clearStoredAffiliate();
  }
}

// Resolves whatever Supabase Auth session currently exists on the affiliate
// client into an AffiliateProfile. Mirrors resolveBuyerSession in buyerAuth.ts.
export async function resolveAffiliateSession(): Promise<{ affiliate: AffiliateProfile | null; error: string | null }> {
  const {
    data: { session },
  } = await supabaseAffiliate.auth.getSession();

  if (!session?.user) {
    clearStoredAffiliate();
    return { affiliate: null, error: null };
  }

  const { data: affiliate, error } = await supabaseAffiliate
    .from('affiliates')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !affiliate) {
    clearStoredAffiliate();
    return { affiliate: null, error: error?.message || null };
  }

  storeAffiliate(affiliate);
  return { affiliate, error: null };
}
