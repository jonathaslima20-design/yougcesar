import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface CriticalProduct {
  id: string;
  title: string;
  featured_image_url: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  status: 'low_stock' | 'out_of_stock';
}

interface InventoryOverviewStats {
  trackedProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalUnits: number;
  criticalProducts: CriticalProduct[];
  loading: boolean;
  error: string | null;
}

export function useInventoryOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<InventoryOverviewStats>({
    trackedProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalUnits: 0,
    criticalProducts: [],
    loading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      const [trackedResponse, lowStockResponse, outOfStockResponse, totalUnitsResponse, criticalResponse] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('track_inventory', true),

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

        supabase
          .from('products')
          .select('stock_quantity')
          .eq('user_id', user.id)
          .eq('track_inventory', true)
          .eq('is_visible_on_storefront', true)
          .gt('stock_quantity', 0),

        supabase
          .from('products')
          .select('id, title, featured_image_url, stock_quantity, low_stock_threshold')
          .eq('user_id', user.id)
          .eq('track_inventory', true)
          .eq('is_visible_on_storefront', true)
          .lte('stock_quantity', 5)
          .order('stock_quantity', { ascending: true })
          .limit(10),
      ]);

      const totalUnits = totalUnitsResponse.data?.reduce(
        (sum, p) => sum + (p.stock_quantity || 0),
        0
      ) || 0;

      const criticalProducts: CriticalProduct[] = (criticalResponse.data || []).map(p => ({
        id: p.id,
        title: p.title,
        featured_image_url: p.featured_image_url,
        stock_quantity: p.stock_quantity ?? 0,
        low_stock_threshold: p.low_stock_threshold ?? 5,
        status: (p.stock_quantity ?? 0) <= 0 ? 'out_of_stock' : 'low_stock',
      }));

      setStats({
        trackedProducts: trackedResponse.count || 0,
        lowStockCount: lowStockResponse.count || 0,
        outOfStockCount: outOfStockResponse.count || 0,
        totalUnits,
        criticalProducts,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching inventory overview:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar dados',
      }));
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...stats, refresh: fetchStats };
}
