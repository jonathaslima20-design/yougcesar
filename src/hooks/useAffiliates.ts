import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Affiliate {
  id: string;
  store_owner_id: string;
  email: string;
  name: string;
  whatsapp: string | null;
  country_code: string;
  affiliate_code: string;
  slug: string;
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

export interface AffiliateCommissionRule {
  id: string;
  affiliate_id: string;
  category_name: string | null;
  commission_percentage: number;
}

export interface AffiliateCommission {
  id: string;
  affiliate_id: string | null;
  order_id: string;
  order_item_id: string;
  product_name_snapshot: string | null;
  category_matched: string | null;
  item_subtotal: number;
  commission_percentage: number;
  commission_amount: number;
  status: 'pending' | 'paid' | 'reversed';
  payment_id: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface AffiliatePayment {
  id: string;
  affiliate_id: string | null;
  store_owner_id: string;
  total_amount: number;
  receipt_url: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

export interface CreateAffiliateInput {
  email: string;
  password: string;
  name: string;
  slug: string;
  whatsapp?: string;
  country_code?: string;
  default_commission_percentage: number;
  commission_trigger: 'confirmed' | 'delivered';
  attribution_window_days: 7 | 15 | 30;
  payment_frequency: 'weekly' | 'biweekly' | 'monthly';
  whatsapp_contact_mode: 'store_default' | 'own_whatsapp';
}

function parseEdgeFunctionError(error: any, fallback: string): string {
  if (error?.context?.body) {
    try {
      const body = typeof error.context.body === 'string' ? JSON.parse(error.context.body) : error.context.body;
      return body.error?.message || body.error || body.message || fallback;
    } catch {
      return error.message || fallback;
    }
  }
  return error?.message || fallback;
}

export function useAffiliates() {
  const { user } = useAuth();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payments, setPayments] = useState<AffiliatePayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAffiliates = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('store_owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAffiliates(data || []);
    } catch (err) {
      console.error('Error fetching affiliates:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchCommissions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('affiliate_commissions')
        .select('*')
        .eq('store_owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCommissions(data || []);
    } catch (err) {
      console.error('Error fetching affiliate commissions:', err);
    }
  }, [user?.id]);

  const fetchPayments = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('affiliate_commission_payments')
        .select('*')
        .eq('store_owner_id', user.id)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching affiliate payments:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchAffiliates();
    fetchCommissions();
    fetchPayments();
  }, [user?.id, fetchAffiliates, fetchCommissions, fetchPayments]);

  const createAffiliate = async (input: CreateAffiliateInput) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Não autenticado');

    const { data, error } = await supabase.functions.invoke('create-affiliate', { body: input });

    if (error) throw new Error(parseEdgeFunctionError(error, 'Erro ao criar afiliado'));
    if (data?.error) throw new Error(data.error);

    await fetchAffiliates();
    return data as { success: boolean; affiliateId: string; affiliateCode: string };
  };

  const resetAffiliatePassword = async (affiliateId: string, password: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Não autenticado');

    const { data, error } = await supabase.functions.invoke('reset-affiliate-password', {
      body: { affiliateId, password },
    });

    if (error) throw new Error(parseEdgeFunctionError(error, 'Erro ao redefinir senha'));
    if (data?.error) throw new Error(data.error);
  };

  const updateAffiliate = async (
    id: string,
    updates: Partial<Pick<Affiliate, 'name' | 'slug' | 'whatsapp' | 'default_commission_percentage' | 'commission_trigger' | 'attribution_window_days' | 'payment_frequency' | 'whatsapp_contact_mode'>>
  ) => {
    const { error } = await supabase.from('affiliates').update(updates).eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('Esse link já está em uso por outro afiliado. Escolha outro.');
      throw error;
    }
    await fetchAffiliates();
  };

  const toggleAffiliateStatus = async (id: string, status: 'active' | 'inactive') => {
    const { error } = await supabase.from('affiliates').update({ status }).eq('id', id);
    if (error) throw error;
    await fetchAffiliates();
  };

  const fetchCommissionRules = async (affiliateId: string): Promise<AffiliateCommissionRule[]> => {
    const { data, error } = await supabase
      .from('affiliate_commission_rules')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .not('category_name', 'is', null);
    if (error) throw error;
    return data || [];
  };

  const saveCommissionRules = async (affiliateId: string, rules: { category_name: string; commission_percentage: number }[]) => {
    const { error: deleteError } = await supabase
      .from('affiliate_commission_rules')
      .delete()
      .eq('affiliate_id', affiliateId)
      .not('category_name', 'is', null);
    if (deleteError) throw deleteError;

    if (rules.length > 0) {
      const { error: insertError } = await supabase
        .from('affiliate_commission_rules')
        .insert(rules.map(r => ({ affiliate_id: affiliateId, category_name: r.category_name, commission_percentage: r.commission_percentage })));
      if (insertError) throw insertError;
    }
  };

  const fetchAffiliateStats = async (affiliateId: string): Promise<{ clicks: number; orders: number }> => {
    const [clicksRes, ordersRes] = await Promise.all([
      supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('affiliate_id', affiliateId),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('affiliate_id', affiliateId),
    ]);
    return { clicks: clicksRes.count || 0, orders: ordersRes.count || 0 };
  };

  const recordAffiliatePayment = async (
    affiliateId: string,
    commissionIds: string[],
    options: { receiptFile?: File | null; notes?: string }
  ) => {
    if (!user?.id) throw new Error('Não autenticado');
    if (commissionIds.length === 0) throw new Error('Selecione ao menos uma comissão');

    const selected = commissions.filter(c => commissionIds.includes(c.id));
    const totalAmount = selected.reduce((sum, c) => sum + Number(c.commission_amount), 0);

    let receiptUrl: string | null = null;
    if (options.receiptFile) {
      const fileExt = options.receiptFile.name.split('.').pop();
      const filePath = `affiliate-receipts/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('public').upload(filePath, options.receiptFile, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      receiptUrl = supabase.storage.from('public').getPublicUrl(filePath).data.publicUrl;
    }

    const { data: payment, error: paymentError } = await supabase
      .from('affiliate_commission_payments')
      .insert({
        affiliate_id: affiliateId,
        store_owner_id: user.id,
        total_amount: totalAmount,
        receipt_url: receiptUrl,
        notes: options.notes || null,
      })
      .select()
      .single();
    if (paymentError) throw paymentError;

    const { error: updateError } = await supabase
      .from('affiliate_commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payment_id: payment.id })
      .in('id', commissionIds);
    if (updateError) throw updateError;

    await Promise.all([fetchCommissions(), fetchPayments()]);
    return payment as AffiliatePayment;
  };

  return {
    affiliates,
    commissions,
    payments,
    loading,
    fetchAffiliates,
    createAffiliate,
    updateAffiliate,
    resetAffiliatePassword,
    toggleAffiliateStatus,
    fetchCommissionRules,
    saveCommissionRules,
    fetchAffiliateStats,
    recordAffiliatePayment,
  };
}
