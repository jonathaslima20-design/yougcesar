import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface CustomFlavor {
  id: string;
  flavor_name: string;
  created_at: string;
}

interface UseCustomFlavorsReturn {
  customFlavors: string[];
  allFlavors: CustomFlavor[];
  loading: boolean;
  addCustomFlavor: (flavorName: string) => Promise<boolean>;
  removeCustomFlavor: (flavorName: string) => Promise<boolean>;
  refreshCustomFlavors: () => Promise<void>;
  error: string | null;
}

const CACHE_DURATION = 5 * 60 * 1000;

export function useCustomFlavors(userId?: string): UseCustomFlavorsReturn {
  const [customFlavors, setCustomFlavors] = useState<string[]>([]);
  const [allFlavors, setAllFlavors] = useState<CustomFlavor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<{ timestamp: number; data: CustomFlavor[] } | null>(null);

  const loadCustomFlavors = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    if (!forceRefresh && cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_DURATION) {
      setAllFlavors(cacheRef.current.data);
      setCustomFlavors(cacheRef.current.data.map(item => item.flavor_name));
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('user_custom_flavors')
        .select('id, flavor_name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;

      const flavors = (data as CustomFlavor[]) || [];
      cacheRef.current = { timestamp: Date.now(), data: flavors };

      setAllFlavors(flavors);
      setCustomFlavors(flavors.map(item => item.flavor_name));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar sabores';
      console.error('Error loading custom flavors:', err);
      setError(errorMessage);
      setCustomFlavors([]);
      setAllFlavors([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addCustomFlavor = useCallback(
    async (flavorName: string): Promise<boolean> => {
      if (!userId || !flavorName.trim()) return false;

      try {
        setError(null);
        const trimmedFlavor = flavorName.trim();

        if (customFlavors.some(f => f.toLowerCase() === trimmedFlavor.toLowerCase())) {
          return true;
        }

        const { data, error: insertError } = await supabase
          .from('user_custom_flavors')
          .insert({
            user_id: userId,
            flavor_name: trimmedFlavor,
          })
          .select();

        if (insertError) {
          if (insertError.code === '23505') {
            return true;
          }
          throw insertError;
        }

        if (data && data.length > 0) {
          const newFlavor = data[0] as CustomFlavor;
          setAllFlavors(prev => [...prev, newFlavor]);
          setCustomFlavors(prev => [...prev, trimmedFlavor]);
          cacheRef.current = null;
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar sabor';
        console.error('Error adding custom flavor:', err);
        setError(errorMessage);
        return false;
      }
    },
    [userId, customFlavors]
  );

  const removeCustomFlavor = useCallback(
    async (flavorName: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        setError(null);
        const { error: deleteError } = await supabase
          .from('user_custom_flavors')
          .delete()
          .eq('user_id', userId)
          .eq('flavor_name', flavorName);

        if (deleteError) throw deleteError;

        setCustomFlavors(prev => prev.filter(f => f !== flavorName));
        setAllFlavors(prev => prev.filter(f => f.flavor_name !== flavorName));
        cacheRef.current = null;

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao remover sabor';
        console.error('Error removing custom flavor:', err);
        setError(errorMessage);
        return false;
      }
    },
    [userId]
  );

  const refreshCustomFlavors = useCallback(async () => {
    cacheRef.current = null;
    await loadCustomFlavors(true);
  }, [loadCustomFlavors]);

  useEffect(() => {
    loadCustomFlavors();
  }, [userId, loadCustomFlavors]);

  return {
    customFlavors,
    allFlavors,
    loading,
    addCustomFlavor,
    removeCustomFlavor,
    refreshCustomFlavors,
    error,
  };
}
