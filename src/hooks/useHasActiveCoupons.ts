import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useHasActiveCoupons(storeOwnerId: string | undefined) {
  const [hasActiveCoupons, setHasActiveCoupons] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeOwnerId) {
      setHasActiveCoupons(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function check() {
      setLoading(true);
      const now = new Date().toISOString();

      const { count, error } = await supabase
        .from('coupons')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', storeOwnerId!)
        .eq('is_active', true)
        .lte('valid_from', now)
        .or(`valid_until.is.null,valid_until.gte.${now}`);

      if (!cancelled) {
        setHasActiveCoupons(!error && (count ?? 0) > 0);
        setLoading(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [storeOwnerId]);

  return { hasActiveCoupons, loading };
}
