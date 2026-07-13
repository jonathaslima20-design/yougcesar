import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalProducts: number;
  totalViews: number;
  uniqueVisitors: number;
  totalLeads: number;
  totalOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
  loading: boolean;
  error: string | null;
}

export function useDashboardStats(periodDays: number = 30) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalViews: 0,
    uniqueVisitors: 0,
    totalLeads: 0,
    totalOrders: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user?.id) {
      setStats({
        totalProducts: 0,
        totalViews: 0,
        uniqueVisitors: 0,
        totalLeads: 0,
        totalOrders: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        loading: false,
        error: null,
      });
      return;
    }

    fetchDashboardStats();
  }, [user?.id, periodDays]);

  const fetchDashboardStats = async () => {
    if (!user?.id) return;

    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user.id);

      if (productsError) throw productsError;

      const productIds = products?.map(p => p.id) || [];
      const safeIds = productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000'];

      const [viewsResponse, uniqueVisitorsResponse, leadsResponse, ordersResponse, lowStockResponse, outOfStockResponse] = await Promise.all([
        supabase
          .from('property_views')
          .select('id', { count: 'exact', head: true })
          .in('property_id', safeIds)
          .gte('viewed_at', startDate.toISOString()),

        supabase
          .from('property_views')
          .select('viewer_id')
          .in('property_id', safeIds)
          .gte('viewed_at', startDate.toISOString()),

        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .in('property_id', safeIds)
          .gte('created_at', startDate.toISOString()),

        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('store_owner_id', user.id)
          .gte('created_at', startDate.toISOString()),

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

      const uniqueViewerIds = new Set(
        uniqueVisitorsResponse.data?.map(v => v.viewer_id) || []
      );

      setStats({
        totalProducts: products?.length || 0,
        totalViews: viewsResponse.count || 0,
        uniqueVisitors: uniqueViewerIds.size,
        totalLeads: leadsResponse.count || 0,
        totalOrders: ordersResponse.count || 0,
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
