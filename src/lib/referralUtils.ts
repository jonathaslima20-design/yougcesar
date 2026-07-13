import { supabase } from './supabase';
import type { ReferralStats } from '@/types';

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  try {
    const { data: commissions, error: commissionsError } = await supabase
      .from('referral_commissions')
      .select(`
        *,
        subscription:subscriptions(status)
      `)
      .eq('referrer_id', userId);

    if (commissionsError) throw commissionsError;

    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('withdrawal_requests')
      .select('amount, status')
      .eq('user_id', userId);

    if (withdrawalsError) throw withdrawalsError;

    const totalCommissions = commissions?.reduce((sum, c) => sum + c.amount, 0) || 0;
    const pendingCommissions = commissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0;
    const paidCommissions = commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0;

    const pendingWithdrawals = withdrawals?.filter(w => w.status === 'pending' || w.status === 'approved').reduce((sum, w) => sum + w.amount, 0) || 0;
    const availableForWithdrawal = Math.max(0, pendingCommissions - pendingWithdrawals);

    return {
      totalReferrals: commissions?.length || 0,
      activeReferrals: commissions?.filter(c => c.subscription?.status === 'active').length || 0,
      totalCommissions,
      pendingCommissions,
      paidCommissions,
      availableForWithdrawal,
    };
  } catch (error) {
    console.error('Error calculating referral stats:', error);
    return {
      totalReferrals: 0,
      activeReferrals: 0,
      totalCommissions: 0,
      pendingCommissions: 0,
      paidCommissions: 0,
      availableForWithdrawal: 0,
    };
  }
}

export function generateReferralLink(referralCode: string): string {
  return `https://vitrineturbo.com/?ref=${referralCode}`;
}

export function validatePixKey(key: string, type: string): boolean {
  const cleanKey = key.replace(/\D/g, '');

  switch (type) {
    case 'cpf':
      return cleanKey.length === 11;
    case 'cnpj':
      return cleanKey.length === 14;
    case 'phone':
      return cleanKey.length === 10 || cleanKey.length === 11;
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case 'random':
      return key.length >= 8;
    default:
      return false;
  }
}

export function formatPixKey(key: string, type: string): string {
  switch (type) {
    case 'cpf':
      const cpf = key.replace(/\D/g, '');
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    case 'cnpj':
      const cnpj = key.replace(/\D/g, '');
      return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    case 'phone':
      const phone = key.replace(/\D/g, '');
      if (phone.length === 11) {
        return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (phone.length === 10) {
        return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      }
      return key;
    default:
      return key;
  }
}

export function getCommissionAmount(planType: string): number {
  const planLower = planType.toLowerCase();

  if (planLower.includes('trimestral') || planLower.includes('quarterly')) {
    return 50.00;
  } else if (planLower.includes('semestral') || planLower.includes('semiannually')) {
    return 70.00;
  } else if (planLower.includes('anual') || planLower.includes('annually')) {
    return 100.00;
  }

  return 0.00;
}

const MIN_COMMISSION = 44.70;

export function calculatePercentageCommission(planPrice: number, percentage: number): number {
  const amount = Math.round(planPrice * (percentage / 100) * 100) / 100;
  return Math.max(amount, MIN_COMMISSION);
}

export function calculateReferralDiscount(planPrice: number, discountPercentage: number): { discount: number; finalPrice: number } {
  const discount = Math.round(planPrice * (discountPercentage / 100) * 100) / 100;
  const finalPrice = Math.round((planPrice - discount) * 100) / 100;
  return { discount, finalPrice };
}

export async function validateReferralCoupon(code: string, currentUserId: string): Promise<{ valid: boolean; referrerId?: string; error?: string }> {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: 'Codigo nao pode ser vazio' };
  }

  const { data: referrer, error } = await supabase
    .from('users')
    .select('id, referral_code, created_at')
    .ilike('referral_code', code.trim())
    .maybeSingle();

  if (error || !referrer) {
    return { valid: false, error: 'Cupom nao encontrado ou invalido' };
  }

  if (referrer.id === currentUserId) {
    return { valid: false, error: 'Voce nao pode usar seu proprio cupom' };
  }

  // Only allow referral discount on the user's first payment
  const { data: priorPayments } = await supabase
    .from('mp_payments')
    .select('id')
    .eq('user_id', currentUserId)
    .eq('status', 'approved')
    .limit(1);

  if (priorPayments && priorPayments.length > 0) {
    return { valid: false, error: 'Desconto de indicacao disponivel apenas no primeiro pagamento' };
  }

  // Reject if user was created before the referrer (temporal impossibility)
  const { data: currentUser } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', currentUserId)
    .maybeSingle();

  if (currentUser && referrer.created_at && currentUser.created_at < referrer.created_at) {
    return { valid: false, error: 'Cupom de indicacao invalido para esta conta' };
  }

  return { valid: true, referrerId: referrer.id };
}

export async function trackReferralClick(referralCode: string): Promise<void> {
  try {
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (referrer) {
      await supabase.from('referral_clicks').insert({
        referral_code: referralCode,
        referrer_id: referrer.id,
        visitor_id: getSessionVisitorId(),
      });
    }
  } catch { /* silent */ }
}

function getSessionVisitorId(): string {
  const key = 'vt_visitor_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}