import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface RankedProduct {
  id: string;
  title: string;
  featured_image_url?: string;
  views: number;
  leads: number;
  conversionRate: number;
  trending: boolean;
  weeklyViews: number[];
}

export function useProductRanking(periodDays: number = 30) {
  const { user } = useAuth();
  const [topProducts, setTopProducts] = useState<RankedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchRanking();
  }, [user?.id, periodDays]);

  const fetchRanking = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      const halfPeriod = Math.floor(periodDays / 2);
      const midDate = new Date();
      midDate.setDate(midDate.getDate() - halfPeriod);

      const { data: products } = await supabase
        .from('products')
        .select('id, title, featured_image_url')
        .eq('user_id', user.id);

      if (!products || products.length === 0) {
        setTopProducts([]);
        setLoading(false);
        return;
      }

      const productIds = products.map(p => p.id);

      const [viewsRes, leadsRes, recentViewsRes, previousViewsRes] = await Promise.all([
        supabase
          .from('property_views')
          .select('property_id, viewed_at')
          .in('property_id', productIds)
          .gte('viewed_at', startDate.toISOString()),

        supabase
          .from('leads')
          .select('property_id')
          .in('property_id', productIds)
          .gte('created_at', startDate.toISOString()),

        supabase
          .from('property_views')
          .select('property_id')
          .in('property_id', productIds)
          .gte('viewed_at', midDate.toISOString()),

        supabase
          .from('property_views')
          .select('property_id')
          .in('property_id', productIds)
          .gte('viewed_at', startDate.toISOString())
          .lt('viewed_at', midDate.toISOString()),
      ]);

      const viewsByProduct = new Map<string, number>();
      const recentViewsByProduct = new Map<string, number>();
      const previousViewsByProduct = new Map<string, number>();
      const leadsByProduct = new Map<string, number>();

      (viewsRes.data || []).forEach(v => {
        viewsByProduct.set(v.property_id, (viewsByProduct.get(v.property_id) || 0) + 1);
      });

      (recentViewsRes.data || []).forEach(v => {
        recentViewsByProduct.set(v.property_id, (recentViewsByProduct.get(v.property_id) || 0) + 1);
      });

      (previousViewsRes.data || []).forEach(v => {
        previousViewsByProduct.set(v.property_id, (previousViewsByProduct.get(v.property_id) || 0) + 1);
      });

      (leadsRes.data || []).forEach(l => {
        leadsByProduct.set(l.property_id, (leadsByProduct.get(l.property_id) || 0) + 1);
      });

      // Build weekly sparkline data for each product (always last 7 days)
      const viewsByProductAndDay = new Map<string, Map<string, number>>();
      (viewsRes.data || []).forEach(v => {
        const dayKey = v.viewed_at.split('T')[0];
        if (!viewsByProductAndDay.has(v.property_id)) {
          viewsByProductAndDay.set(v.property_id, new Map());
        }
        const dayMap = viewsByProductAndDay.get(v.property_id)!;
        dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
      });

      const ranked: RankedProduct[] = products.map(p => {
        const views = viewsByProduct.get(p.id) || 0;
        const leads = leadsByProduct.get(p.id) || 0;
        const recentViews = recentViewsByProduct.get(p.id) || 0;
        const prevViews = previousViewsByProduct.get(p.id) || 0;
        const trending = prevViews > 0 ? recentViews > prevViews * 1.3 : recentViews >= 5;

        const weeklyViews: number[] = [];
        for (let i = 6; i >= 0; i--) {
          const day = new Date();
          day.setDate(day.getDate() - i);
          const dayKey = day.toISOString().split('T')[0];
          const dayMap = viewsByProductAndDay.get(p.id);
          weeklyViews.push(dayMap?.get(dayKey) || 0);
        }

        return {
          id: p.id,
          title: p.title,
          featured_image_url: p.featured_image_url,
          views,
          leads,
          conversionRate: views > 0 ? (leads / views) * 100 : 0,
          trending,
          weeklyViews,
        };
      });

      ranked.sort((a, b) => b.views - a.views);
      setTopProducts(ranked.slice(0, 5));
      setLoading(false);
    } catch {
      setTopProducts([]);
      setLoading(false);
    }
  };

  return { topProducts, loading };
}
