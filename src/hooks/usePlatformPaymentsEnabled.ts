import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Platform-wide kill switch, optionally merged with a merchant's own
// admin-granted test override (users.payments_test_override) so a single
// account can finish and validate the feature while it stays off globally.
export function usePlatformPaymentsEnabled(userId?: string) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: platformData }, { data: userData }] = await Promise.all([
        supabase
          .from('platform_payment_settings')
          .select('online_payments_enabled')
          .maybeSingle(),
        userId
          ? supabase.from('users').select('payments_test_override').eq('id', userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setEnabled((platformData?.online_payments_enabled ?? false) || !!userData?.payments_test_override);
      setLoading(false);
    })();
  }, [userId]);

  return { enabled, loading };
}
