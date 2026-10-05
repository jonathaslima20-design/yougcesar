import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Numbers come from get_store_metrics (migration 20261005100000), so every card
// uses the same definitions. See that migration for what each figure counts.
interface DashboardStats {
  totalProducts: number;
  totalViews: number;
  uniqueVisitors: number;
  totalContacts: number;
  whatsappClicks: number;
  totalOrders: number;
  totalSales: number;
  totalRevenue: number;
  purchasesPerVisitor: number;
  contactsPerVisitor: number;
  lowStockCount: number;
  outOfStockCount: number;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATS: Omit<DashboardStats, 'loading' | 'error'> = {
  totalProducts: 0,
  totalViews: 0,
  uniqueVisitors: 0,
  totalContacts: 0,
  whatsappClicks: 0,
  totalOrders: 0,
  totalSales: 0,
  totalRevenue: 0,
  purchasesPerVisitor: 0,
  contactsPerVisitor: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
};

export function useDashboardStats(periodDays: number = 30) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    ...EMPTY_STATS,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user?.id) {
      setStats({ ...EMPTY_STATS, loading: false, error: null });
      return;
    }

    fetchDashboardStats();
  }, [user?.id, periodDays]);

  const fetchDashboardStats = async () => {
    if (!user?.id) return;

    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      const [productsResponse, { data: metrics, error: metricsError }, lowStockResponse, outOfStockResponse] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),

        supabase.rpc('get_store_metrics', { p_days: periodDays }),

        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('track_inventory', true)
          .eq('is_visible_on_storefront', true)
          .gt('stock_quantity', 0)
          .lte('stock_quantity', 5),

        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('track_inventory', true)
          .eq('is_visible_on_storefront', true)
          .lte('stock_quantity', 0),
      ]);

      if (productsResponse.error) throw productsResponse.error;
      if (metricsError) throw metricsError;

      const m = (metrics ?? {}) as Record<string, number>;

      setStats({
        totalProducts: productsResponse.count || 0,
        totalViews: m.views ?? 0,
        uniqueVisitors: m.visitors ?? 0,
        totalContacts: m.contacts ?? 0,
        whatsappClicks: m.whatsapp_clicks ?? 0,
        totalOrders: m.orders ?? 0,
        totalSales: m.sales ?? 0,
        totalRevenue: Number(m.revenue ?? 0),
        purchasesPerVisitor: Number(m.purchases_per_visitor ?? 0),
        contactsPerVisitor: Number(m.contacts_per_visitor ?? 0),
        lowStockCount: lowStockResponse.count || 0,
        outOfStockCount: outOfStockResponse.count || 0,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar estatísticas',
      }));
    }
  };

  const refresh = () => {
    fetchDashboardStats();
  };

  return { ...stats, refresh };
}
