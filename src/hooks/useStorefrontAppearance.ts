import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_APPEARANCE, type StorefrontAppearance } from '@/lib/appearanceDefaults';

interface UseStorefrontAppearanceResult {
  appearance: StorefrontAppearance;
  loading: boolean;
  isCustomized: boolean;
  save: (data: Partial<StorefrontAppearance>) => Promise<boolean>;
  reset: () => Promise<boolean>;
  refresh: () => void;
}

export function useStorefrontAppearance(
  userId: string | undefined,
  initialAppearance?: StorefrontAppearance | null
): UseStorefrontAppearanceResult {
  const hasInitial = !!initialAppearance;
  const [appearance, setAppearance] = useState<StorefrontAppearance>(
    initialAppearance || DEFAULT_APPEARANCE
  );
  const [loading, setLoading] = useState(!hasInitial);
  const [isCustomized, setIsCustomized] = useState(hasInitial);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (initialAppearance) {
      setAppearance(initialAppearance);
      setIsCustomized(true);
      setLoading(false);
    }
  }, [initialAppearance]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    if (hasInitial && refreshKey === 0) {
      return;
    }

    const fetchAppearance = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('storefront_appearance')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching appearance:', error);
        if (!hasInitial) {
          setAppearance(DEFAULT_APPEARANCE);
          setIsCustomized(false);
        }
      } else if (data) {
        setAppearance(data as StorefrontAppearance);
        setIsCustomized(true);
      } else {
        setAppearance(DEFAULT_APPEARANCE);
        setIsCustomized(false);
      }
      setLoading(false);
    };

    fetchAppearance();
  }, [userId, refreshKey]);

  const save = useCallback(async (data: Partial<StorefrontAppearance>): Promise<boolean> => {
    if (!userId) return false;

    const payload = { ...data, user_id: userId, updated_at: new Date().toISOString() };
    delete payload.id;

    if (isCustomized) {
      const { error } = await supabase
        .from('storefront_appearance')
        .update(payload)
        .eq('user_id', userId);
      if (error) {
        console.error('Error updating appearance:', error);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('storefront_appearance')
        .insert(payload);
      if (error) {
        console.error('Error inserting appearance:', error);
        return false;
      }
      setIsCustomized(true);
    }

    setAppearance(prev => ({ ...prev, ...data }));
    return true;
  }, [userId, isCustomized]);

  const reset = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    const resetData = { ...DEFAULT_APPEARANCE, user_id: userId, updated_at: new Date().toISOString() };

    if (isCustomized) {
      const { error } = await supabase
        .from('storefront_appearance')
        .update(resetData)
        .eq('user_id', userId);
      if (error) {
        console.error('Error resetting appearance:', error);
        return false;
      }
    }

    setAppearance(DEFAULT_APPEARANCE);
    return true;
  }, [userId, isCustomized]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return { appearance, loading, isCustomized, save, reset, refresh };
}
