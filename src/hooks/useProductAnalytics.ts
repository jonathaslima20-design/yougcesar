import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ProductAnalytics {
  product_id: string;
  views_count: number;
  leads_count: number;
  orders_count: number;
  weekly_views: number[];
  trending: boolean;
}

export function useProductAnalytics(periodDays: number = 30) {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Map<string, ProductAnalytics>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchAnalytics();
  }, [user?.id, periodDays]);

  const fetchAnalytics = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_product_analytics_summary', {
        p_user_id: user.id,
        p_period_days: periodDays,
      });

      if (error) {
        console.error('Error fetching product analytics:', error);
        setAnalytics(new Map());
        return;
      }

      const map = new Map<string, ProductAnalytics>();

      if (data && Array.isArray(data)) {
        for (const row of data) {
          const weeklyArray: number[] = Array.isArray(row.weekly_views)
            ? row.weekly_views.map((d: { count: number }) => d.count || 0)
            : [0, 0, 0, 0, 0, 0, 0];

          const recentHalf = weeklyArray.slice(4).reduce((a: number, b: number) => a + b, 0);
          const earlierHalf = weeklyArray.slice(0, 4).reduce((a: number, b: number) => a + b, 0);
          const trending = earlierHalf > 0 ? recentHalf > earlierHalf * 1.3 : recentHalf >= 3;

          map.set(row.product_id, {
            product_id: row.product_id,
            views_count: Number(row.views_count) || 0,
            leads_count: Number(row.leads_count) || 0,
            orders_count: Number(row.orders_count) || 0,
            weekly_views: weeklyArray,
            trending,
          });
        }
      }

      setAnalytics(map);
    } catch (err) {
      console.error('Error in useProductAnalytics:', err);
      setAnalytics(new Map());
    } finally {
      setLoading(false);
    }
  };

  const getProductAnalytics = (productId: string): ProductAnalytics | null => {
    return analytics.get(productId) || null;
  };

  return { analytics, loading, getProductAnalytics, refetch: fetchAnalytics };
}
