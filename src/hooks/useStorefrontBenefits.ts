import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface StorefrontBenefit {
  id: string;
  user_id: string;
  icon: string;
  title: string;
  subtitle: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type NewStorefrontBenefit = Pick<StorefrontBenefit, 'icon' | 'title' | 'subtitle'> &
  Partial<Pick<StorefrontBenefit, 'sort_order' | 'is_active'>>;

interface UseStorefrontBenefitsOptions {
  activeOnly?: boolean;
}

export function useStorefrontBenefits(userId: string | undefined, options: UseStorefrontBenefitsOptions = {}) {
  const { activeOnly = false } = options;
  const [benefits, setBenefits] = useState<StorefrontBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setBenefits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchBenefits = async () => {
      let query = supabase
        .from('storefront_benefits')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        console.error('Error fetching storefront benefits:', error);
        setBenefits([]);
      } else {
        setBenefits((data || []) as StorefrontBenefit[]);
      }
      setLoading(false);
    };

    fetchBenefits();
    return () => {
      cancelled = true;
    };
  }, [userId, activeOnly, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const create = useCallback(async (userId: string, benefit: NewStorefrontBenefit): Promise<boolean> => {
    const { error } = await supabase.from('storefront_benefits').insert({
      user_id: userId,
      sort_order: benefit.sort_order ?? benefits.length,
      is_active: benefit.is_active ?? true,
      ...benefit,
    });
    if (error) {
      console.error('Error creating storefront benefit:', error);
      return false;
    }
    refresh();
    return true;
  }, [benefits.length, refresh]);

  const createMany = useCallback(async (userId: string, items: NewStorefrontBenefit[]): Promise<boolean> => {
    const { error } = await supabase.from('storefront_benefits').insert(
      items.map((item, index) => ({
        user_id: userId,
        sort_order: item.sort_order ?? index,
        is_active: item.is_active ?? true,
        ...item,
      }))
    );
    if (error) {
      console.error('Error creating storefront benefits:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const update = useCallback(async (id: string, data: Partial<StorefrontBenefit>): Promise<boolean> => {
    const { error } = await supabase
      .from('storefront_benefits')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Error updating storefront benefit:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('storefront_benefits').delete().eq('id', id);
    if (error) {
      console.error('Error deleting storefront benefit:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const move = useCallback(async (id: string, direction: 'up' | 'down'): Promise<boolean> => {
    const index = benefits.findIndex((b) => b.id === id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= benefits.length) return false;

    const current = benefits[index];
    const other = benefits[swapWith];
    const [a, b] = await Promise.all([
      supabase.from('storefront_benefits').update({ sort_order: other.sort_order }).eq('id', current.id),
      supabase.from('storefront_benefits').update({ sort_order: current.sort_order }).eq('id', other.id),
    ]);
    if (a.error || b.error) {
      console.error('Error reordering storefront benefits:', a.error || b.error);
      return false;
    }
    refresh();
    return true;
  }, [benefits, refresh]);

  return { benefits, loading, create, createMany, update, remove, move, refresh };
}
