import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { PackagingPreset } from '@/types';

type PackagingPresetInput = Omit<PackagingPreset, 'id' | 'user_id' | 'created_at'>;

interface UseProductPackagingPresetsReturn {
  presets: PackagingPreset[];
  loading: boolean;
  error: string | null;
  addPreset: (data: PackagingPresetInput) => Promise<PackagingPreset | null>;
  updatePreset: (id: string, data: Partial<PackagingPresetInput>) => Promise<boolean>;
  removePreset: (id: string) => Promise<boolean>;
  getPresetsByType: (packageType: PackagingPreset['package_type']) => PackagingPreset[];
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useProductPackagingPresets(userId?: string): UseProductPackagingPresetsReturn {
  const [presets, setPresets] = useState<PackagingPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<{ timestamp: number; data: PackagingPreset[] } | null>(null);

  const loadPresets = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    if (!forceRefresh && cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_DURATION) {
      setPresets(cacheRef.current.data);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('product_packaging_presets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;

      const rows = (data || []) as PackagingPreset[];
      cacheRef.current = { timestamp: Date.now(), data: rows };
      setPresets(rows);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar embalagens salvas';
      console.error('Error loading packaging presets:', err);
      setError(errorMessage);
      setPresets([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addPreset = useCallback(
    async (presetData: PackagingPresetInput): Promise<PackagingPreset | null> => {
      if (!userId || !presetData.preset_name.trim()) return null;

      try {
        setError(null);
        const { data, error: insertError } = await supabase
          .from('product_packaging_presets')
          .insert({ ...presetData, preset_name: presetData.preset_name.trim(), user_id: userId })
          .select()
          .single();

        if (insertError) throw insertError;

        const created = data as PackagingPreset;
        setPresets((prev) => [...prev, created]);
        cacheRef.current = null;
        return created;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar embalagem';
        console.error('Error adding packaging preset:', err);
        setError(errorMessage);
        return null;
      }
    },
    [userId]
  );

  const updatePreset = useCallback(
    async (id: string, presetData: Partial<PackagingPresetInput>): Promise<boolean> => {
      if (!userId) return false;

      try {
        setError(null);
        const { error: updateError } = await supabase
          .from('product_packaging_presets')
          .update(presetData)
          .eq('id', id)
          .eq('user_id', userId);

        if (updateError) throw updateError;

        setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...presetData } : p)));
        cacheRef.current = null;
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar embalagem';
        console.error('Error updating packaging preset:', err);
        setError(errorMessage);
        return false;
      }
    },
    [userId]
  );

  const removePreset = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        setError(null);
        const { error: deleteError } = await supabase
          .from('product_packaging_presets')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);

        if (deleteError) throw deleteError;

        setPresets((prev) => prev.filter((p) => p.id !== id));
        cacheRef.current = null;
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao remover embalagem';
        console.error('Error removing packaging preset:', err);
        setError(errorMessage);
        return false;
      }
    },
    [userId]
  );

  const getPresetsByType = useCallback(
    (packageType: PackagingPreset['package_type']) => presets.filter((p) => p.package_type === packageType),
    [presets]
  );

  useEffect(() => {
    loadPresets();
  }, [userId, loadPresets]);

  return {
    presets,
    loading,
    error,
    addPreset,
    updatePreset,
    removePreset,
    getPresetsByType,
  };
}
