import { useEffect, useState } from 'react';
import { supabaseBuyer } from '@/lib/supabaseBuyer';

export function useCashbackBalance(customerId: string | undefined, storeOwnerId: string | undefined) {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId || !storeOwnerId) {
      setBalance(0);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data } = await supabaseBuyer
        .from('cashback_balances')
        .select('balance')
        .eq('customer_id', customerId)
        .eq('store_owner_id', storeOwnerId)
        .maybeSingle();
      if (!cancelled) {
        setBalance(data?.balance ?? 0);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, storeOwnerId]);

  return { balance, loading };
}
