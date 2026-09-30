import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface StorefrontBanner {
  id: string;
  user_id: string;
  image_url_desktop: string;
  image_url_mobile: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type NewStorefrontBanner = Pick<StorefrontBanner, 'image_url_desktop' | 'image_url_mobile'> &
  Partial<Pick<StorefrontBanner, 'link_url' | 'sort_order' | 'is_active'>>;

interface UseStorefrontBannersOptions {
  activeOnly?: boolean;
}

export function useStorefrontBanners(userId: string | undefined, options: UseStorefrontBannersOptions = {}) {
  const { activeOnly = false } = options;
  const [banners, setBanners] = useState<StorefrontBanner[]>([]);
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
        .from('storefront_banners')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        console.error('Error fetching storefront banners:', error);
        setBanners([]);
      } else {
        setBanners((data || []) as StorefrontBanner[]);
      }
      setLoading(false);
    };

    fetchBanners();
    return () => {
      cancelled = true;
    };
  }, [userId, activeOnly, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const create = useCallback(async (userId: string, banner: NewStorefrontBanner): Promise<boolean> => {
    // Based on the highest sort_order actually in use, not banners.length — a
    // banner deleted earlier leaves a gap that .length doesn't account for,
    // which was producing duplicate sort_order values (and silently breaking
    // the up/down reorder buttons whenever two banners shared one).
    const nextOrder = banners.length > 0 ? Math.max(...banners.map((b) => b.sort_order)) + 1 : 0;
    const { error } = await supabase.from('storefront_banners').insert({
      user_id: userId,
      sort_order: banner.sort_order ?? nextOrder,
      is_active: banner.is_active ?? true,
      ...banner,
    });
    if (error) {
      console.error('Error creating storefront banner:', error);
      return false;
    }
    refresh();
    return true;
  }, [banners, refresh]);

  const update = useCallback(async (id: string, data: Partial<StorefrontBanner>): Promise<boolean> => {
    const { error } = await supabase
      .from('storefront_banners')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Error updating storefront banner:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('storefront_banners').delete().eq('id', id);
    if (error) {
      console.error('Error deleting storefront banner:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const move = useCallback(async (id: string, direction: 'up' | 'down'): Promise<boolean> => {
    const index = banners.findIndex((b) => b.id === id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= banners.length) return false;

    // Renumbers every banner 0..N-1 from the new order, instead of swapping the
    // two banners' existing sort_order values — swapping is a no-op whenever
    // they happen to share the same value (which `create` could previously
    // produce), so a reorder click could silently do nothing. Renumbering from
    // scratch always produces a valid, unique order and self-heals any old
    // duplicates the moment a merchant reorders again.
    const reordered = [...banners];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

    const results = await Promise.all(
      reordered.map((b, i) => supabase.from('storefront_banners').update({ sort_order: i }).eq('id', b.id))
    );
    const failed = results.find((r) => r.error);
    if (failed) {
      console.error('Error reordering storefront banners:', failed.error);
      return false;
    }
    refresh();
    return true;
  }, [banners, refresh]);

  return { banners, loading, create, update, remove, move, refresh };
}
