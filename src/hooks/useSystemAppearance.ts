import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_APPEARANCE, type StorefrontAppearance } from '@/lib/appearanceDefaults';

interface UseSystemAppearanceResult {
  appearance: StorefrontAppearance;
  loading: boolean;
}

export function useSystemAppearance(): UseSystemAppearanceResult {
  const [appearance, setAppearance] = useState<StorefrontAppearance>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_storefront_appearance')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setAppearance(DEFAULT_APPEARANCE);
      } else {
        const { id, updated_by, updated_at, created_at, ...rest } = data;
        setAppearance(rest as StorefrontAppearance);
      }
      setLoading(false);
    };

    fetch();
  }, []);

  return { appearance, loading };
}

interface UseAdminSystemAppearanceResult {
  appearance: StorefrontAppearance;
  loading: boolean;
  save: (data: Partial<StorefrontAppearance>, adminId: string) => Promise<boolean>;
  reset: (adminId: string) => Promise<boolean>;
  refresh: () => void;
}

export function useAdminSystemAppearance(): UseAdminSystemAppearanceResult {
  const [appearance, setAppearance] = useState<StorefrontAppearance>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_storefront_appearance')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setAppearance(DEFAULT_APPEARANCE);
        setRecordId(null);
      } else {
        const { id, updated_by, updated_at, created_at, ...rest } = data;
        setAppearance(rest as StorefrontAppearance);
        setRecordId(id);
      }
      setLoading(false);
    };

    fetchData();
  }, [refreshKey]);

  const save = useCallback(async (data: Partial<StorefrontAppearance>, adminId: string): Promise<boolean> => {
    const payload = {
      ...data,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    };
    delete (payload as any).id;
    delete (payload as any).user_id;

    if (recordId) {
      const { error } = await supabase
        .from('system_storefront_appearance')
        .update(payload)
        .eq('id', recordId);
      if (error) {
        console.error('Error updating system appearance:', error);
        return false;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('system_storefront_appearance')
        .insert(payload)
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('Error inserting system appearance:', error);
        return false;
      }
      if (inserted) setRecordId(inserted.id);
    }

    setAppearance(prev => ({ ...prev, ...data }));
    return true;
  }, [recordId]);

  const reset = useCallback(async (adminId: string): Promise<boolean> => {
    const payload = {
      ...DEFAULT_APPEARANCE,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    };

    if (recordId) {
      const { error } = await supabase
        .from('system_storefront_appearance')
        .update(payload)
        .eq('id', recordId);
      if (error) {
        console.error('Error resetting system appearance:', error);
        return false;
      }
    }

    setAppearance(DEFAULT_APPEARANCE);
    return true;
  }, [recordId]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return { appearance, loading, save, reset, refresh };
}
