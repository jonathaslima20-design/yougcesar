import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface StorefrontMiniBanner {
  id: string;
  user_id: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type NewStorefrontMiniBanner = Pick<StorefrontMiniBanner, 'image_url'> &
  Partial<Pick<StorefrontMiniBanner, 'link_url' | 'sort_order' | 'is_active'>>;

interface UseStorefrontMiniBannersOptions {
  activeOnly?: boolean;
}

export function useStorefrontMiniBanners(userId: string | undefined, options: UseStorefrontMiniBannersOptions = {}) {
  const { activeOnly = false } = options;
  const [banners, setBanners] = useState<StorefrontMiniBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setBanners([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchBanners = async () => {
      let query = supabase
        .from('storefront_mini_banners')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        console.error('Error fetching storefront mini banners:', error);
        setBanners([]);
      } else {
        setBanners((data || []) as StorefrontMiniBanner[]);
      }
      setLoading(false);
    };

    fetchBanners();
    return () => {
      cancelled = true;
    };
  }, [userId, activeOnly, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const create = useCallback(async (userId: string, banner: NewStorefrontMiniBanner): Promise<boolean> => {
    const { error } = await supabase.from('storefront_mini_banners').insert({
      user_id: userId,
      sort_order: banner.sort_order ?? banners.length,
      is_active: banner.is_active ?? true,
      ...banner,
    });
    if (error) {
      console.error('Error creating storefront mini banner:', error);
      return false;
    }
    refresh();
    return true;
  }, [banners.length, refresh]);

  const update = useCallback(async (id: string, data: Partial<StorefrontMiniBanner>): Promise<boolean> => {
    const { error } = await supabase
      .from('storefront_mini_banners')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Error updating storefront mini banner:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('storefront_mini_banners').delete().eq('id', id);
    if (error) {
      console.error('Error deleting storefront mini banner:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const move = useCallback(async (id: string, direction: 'up' | 'down'): Promise<boolean> => {
    const index = banners.findIndex((b) => b.id === id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= banners.length) return false;

    const current = banners[index];
    const other = banners[swapWith];
    const [a, b] = await Promise.all([
      supabase.from('storefront_mini_banners').update({ sort_order: other.sort_order }).eq('id', current.id),
      supabase.from('storefront_mini_banners').update({ sort_order: current.sort_order }).eq('id', other.id),
    ]);
    if (a.error || b.error) {
      console.error('Error reordering storefront mini banners:', a.error || b.error);
      return false;
    }
    refresh();
    return true;
  }, [banners, refresh]);

  return { banners, loading, create, update, remove, move, refresh };
}
