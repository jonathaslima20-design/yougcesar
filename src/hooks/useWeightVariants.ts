import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { WeightVariant } from '@/types';

interface UseWeightVariantsReturn {
  weightVariants: WeightVariant[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveVariants: (productId: string, variants: WeightVariant[]) => Promise<boolean>;
}

export function useWeightVariants(productId?: string): UseWeightVariantsReturn {
  const [weightVariants, setWeightVariants] = useState<WeightVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId) {
      setWeightVariants([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('product_weight_variants')
        .select('*')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });

      if (queryError) throw queryError;
      setWeightVariants((data as WeightVariant[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar variações';
      console.error('Error loading weight variants:', err);
      setError(errorMessage);
      setWeightVariants([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const saveVariants = useCallback(
    async (pid: string, variants: WeightVariant[]): Promise<boolean> => {
      try {
        setError(null);

        const { error: deleteError } = await supabase
          .from('product_weight_variants')
          .delete()
          .eq('product_id', pid);

        if (deleteError) throw deleteError;

        if (variants.length === 0) {
          setWeightVariants([]);
          return true;
        }

        const rows = variants.map((v, idx) => ({
          product_id: pid,
          label: v.label.trim(),
          unit_value: Number(v.unit_value) || 0,
          unit_type: v.unit_type,
          price: Number(v.price) || 0,
          discounted_price: v.discounted_price ?? null,
          display_order: idx,
        }));

        const { data, error: insertError } = await supabase
          .from('product_weight_variants')
          .insert(rows)
          .select();

        if (insertError) throw insertError;

        setWeightVariants((data as WeightVariant[]) || []);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar variações';
        console.error('Error saving weight variants:', err);
        setError(errorMessage);
        return false;
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  return {
    weightVariants,
    loading,
    error,
    refresh: load,
    saveVariants,
  };
}
