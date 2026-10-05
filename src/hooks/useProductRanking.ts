import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface RankedProduct {
  id: string;
  title: string;
  featured_image_url?: string;
  views: number;
  // Contatos in the period (no WhatsApp clicks).
  leads: number;
  // Contatos por visitante (%).
  conversionRate: number;
  trending: boolean;
  weeklyViews: number[];
}

// Ranking comes from get_product_ranking (migration 20261005110000).
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

      const { data, error } = await supabase.rpc('get_product_ranking', { p_days: periodDays, p_limit: 5 });
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        title: string;
        featured_image_url: string | null;
        views: number;
        contacts: number;
        contacts_per_visitor: number;
        trending: boolean;
        weekly_views: number[] | null;
      }>;

      setTopProducts(
        rows.map(r => ({
          id: r.id,
          title: r.title,
          featured_image_url: r.featured_image_url ?? undefined,
          views: r.views,
          leads: r.contacts,
          conversionRate: Number(r.contacts_per_visitor),
          trending: r.trending,
          weeklyViews: r.weekly_views ?? [0, 0, 0, 0, 0, 0, 0],
        }))
      );
      setLoading(false);
    } catch {
      setTopProducts([]);
      setLoading(false);
    }
  };

  return { topProducts, loading };
}
