import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function usePlatformPaymentsEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('platform_payment_settings')
        .select('online_payments_enabled')
        .maybeSingle();
      setEnabled(data?.online_payments_enabled ?? false);
      setLoading(false);
    })();
  }, []);

  return { enabled, loading };
}
