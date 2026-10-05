import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface RevenueStats {
  totalRevenue: number;
  previousRevenue: number;
  revenueChange: number;
  averageTicket: number;
  totalDelivered: number;
  weeklyRevenue: { date: string; revenue: number }[];
  loading: boolean;
}

// Figures come from get_store_revenue (migration 20261005120000). A venda counts
// only when confirmed (or later) and, for online orders, paid. Same as the
// dashboard's Vendas card.
export function useDashboardRevenue(periodDays: number = 30) {
  const { user } = useAuth();
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    previousRevenue: 0,
    revenueChange: 0,
    averageTicket: 0,
    totalDelivered: 0,
    weeklyRevenue: [],
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }
    fetchRevenue();
  }, [user?.id, periodDays]);

  const fetchRevenue = async () => {
    if (!user?.id) return;

    try {
      setStats(prev => ({ ...prev, loading: true }));

      const { data, error } = await supabase.rpc('get_store_revenue', { p_days: periodDays });
      if (error) throw error;

      const r = (data ?? {}) as {
        total_revenue: number;
        previous_revenue: number;
        sales: number;
        delivered: number;
        weekly: { date: string; revenue: number }[];
      };

      const totalRevenue = Number(r.total_revenue ?? 0);
      const previousRevenue = Number(r.previous_revenue ?? 0);
      const salesCount = Number(r.sales ?? 0);

      const revenueChange = previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : totalRevenue > 0 ? 100 : 0;

      setStats({
        totalRevenue,
        previousRevenue,
        revenueChange,
        averageTicket: salesCount > 0 ? totalRevenue / salesCount : 0,
        totalDelivered: Number(r.delivered ?? 0),
        weeklyRevenue: (r.weekly ?? []).map(w => ({ date: w.date, revenue: Number(w.revenue) })),
        loading: false,
      });
    } catch {
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  return stats;
}
