import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface RecentUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface PartnerDashboardStats {
  totalUsers: number;
  newUsers30Days: number;
  clickCount: number;
  recentUsers: RecentUser[];
  loading: boolean;
  error: string | null;
}

export function usePartnerDashboardStats(partnerId: string | undefined) {
  const [stats, setStats] = useState<PartnerDashboardStats>({
    totalUsers: 0,
    newUsers30Days: 0,
    clickCount: 0,
    recentUsers: [],
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

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [totalRes, newRes, clicksRes, recentRes] = await Promise.all([
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('managed_by_partner_id', partnerId),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('managed_by_partner_id', partnerId)
          .gte('created_at', thirtyDaysAgo),
        supabase
          .from('referral_clicks')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', partnerId),
        supabase
          .from('users')
          .select('id, name, email, created_at')
          .eq('managed_by_partner_id', partnerId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setStats({
        totalUsers: totalRes.count || 0,
        newUsers30Days: newRes.count || 0,
        clickCount: clicksRes.count || 0,
        recentUsers: recentRes.data || [],
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setStats((prev) => ({ ...prev, loading: false, error: error.message || 'Erro ao carregar estatísticas' }));
    }
  }, [partnerId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refresh: fetchStats };
}
