import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface PartnerCommissionTier {
  id: string;
  min_active_users: number;
  commission_percentage: number;
  label: string | null;
}

interface MonthlyBucket {
  month: string;
  new: number;
  renewal: number;
}

export interface PartnerCommissionStats {
  totalEarned: number;
  pendingAmount: number;
  paidAmount: number;
  monthlySeries: MonthlyBucket[];
  tiers: PartnerCommissionTier[];
  currentTier: PartnerCommissionTier | null;
  nextTier: PartnerCommissionTier | null;
  progressToNextTier: number;
  activeUserCount: number;
  minimumWithdrawalAmount: number;
  loading: boolean;
  error: string | null;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function usePartnerCommissionStats(partnerId: string | undefined) {
  const [stats, setStats] = useState<PartnerCommissionStats>({
    totalEarned: 0,
    pendingAmount: 0,
    paidAmount: 0,
    monthlySeries: [],
    tiers: [],
    currentTier: null,
    nextTier: null,
    progressToNextTier: 0,
    activeUserCount: 0,
    minimumWithdrawalAmount: 50,
    loading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    if (!partnerId) {
      setStats((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      setStats((prev) => ({ ...prev, loading: true, error: null }));

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);

      const [commissionsRes, tiersRes, activeCountRes, settingsRes] = await Promise.all([
        supabase
          .from('partner_commissions')
          .select('amount, status, type, created_at')
          .eq('partner_id', partnerId)
          .gte('created_at', twelveMonthsAgo.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('partner_commission_tiers')
          .select('id, min_active_users, commission_percentage, label')
          .eq('is_active', true)
          .order('min_active_users', { ascending: true }),
        supabase.rpc('partner_active_user_count', { p_partner_id: partnerId }),
        supabase.from('partner_settings').select('minimum_withdrawal_amount').limit(1).maybeSingle(),
      ]);

      const commissions = commissionsRes.data || [];
      const tiers = tiersRes.data || [];
      const activeUserCount = activeCountRes.data || 0;

      const totalEarned = commissions
        .filter((c) => c.status === 'pending' || c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount), 0);
      const pendingAmount = commissions.filter((c) => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0);
      const paidAmount = commissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0);

      const buckets = new Map<string, MonthlyBucket>();
      const cursor = new Date(twelveMonthsAgo);
      for (let i = 0; i < 12; i++) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        buckets.set(key, { month: MONTH_LABELS[cursor.getMonth()], new: 0, renewal: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      for (const c of commissions) {
        if (c.status === 'reversed') continue;
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const bucket = buckets.get(key);
        if (bucket) {
          if (c.type === 'renewal') bucket.renewal += Number(c.amount);
          else bucket.new += Number(c.amount);
        }
      }

      let currentTier: PartnerCommissionTier | null = null;
      let nextTier: PartnerCommissionTier | null = null;
      for (let i = 0; i < tiers.length; i++) {
        if (tiers[i].min_active_users <= activeUserCount) {
          currentTier = tiers[i];
          nextTier = tiers[i + 1] || null;
        }
      }
      if (!currentTier && tiers.length > 0) {
        currentTier = tiers[0];
        nextTier = tiers[1] || null;
      }

      let progressToNextTier = 0;
      if (currentTier && nextTier && nextTier.min_active_users > currentTier.min_active_users) {
        progressToNextTier = Math.min(
          1,
          (activeUserCount - currentTier.min_active_users) / (nextTier.min_active_users - currentTier.min_active_users)
        );
      } else if (currentTier && !nextTier) {
        progressToNextTier = 1;
      }

      setStats({
        totalEarned,
        pendingAmount,
        paidAmount,
        monthlySeries: Array.from(buckets.values()),
        tiers,
        currentTier,
        nextTier,
        progressToNextTier,
        activeUserCount,
        minimumWithdrawalAmount: settingsRes.data?.minimum_withdrawal_amount ?? 50,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setStats((prev) => ({ ...prev, loading: false, error: error.message || 'Erro ao carregar comissões' }));
    }
  }, [partnerId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refresh: fetchStats };
}
