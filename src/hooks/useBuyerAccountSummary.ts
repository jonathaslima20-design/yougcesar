import { useEffect, useState } from 'react';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import type { OrderStatus } from '@/types';

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipped'];

export interface BuyerAccountSummary {
  totalSpent: number;
  ordersCount: number;
  activeOrdersCount: number;
  cashbackTotal: number;
  loading: boolean;
}

const EMPTY_SUMMARY: Omit<BuyerAccountSummary, 'loading'> = {
  totalSpent: 0,
  ordersCount: 0,
  activeOrdersCount: 0,
  cashbackTotal: 0,
};

// Always scoped to ONE store: the buyer area shows each store as its own
// account, so totals/tier/cashback never mix in what was bought elsewhere.
export function useBuyerAccountSummary(
  customerId: string | undefined,
  storeOwnerId: string | undefined
): BuyerAccountSummary {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId || !storeOwnerId) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [{ data: orders }, { data: balance }] = await Promise.all([
        supabaseBuyer.from('orders').select('status, total').eq('store_owner_id', storeOwnerId),
        supabaseBuyer
          .from('cashback_balances')
          .select('balance')
          .eq('store_owner_id', storeOwnerId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const totalSpent = (orders || [])
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0);
      const activeOrdersCount = (orders || []).filter((o) =>
        ACTIVE_STATUSES.includes(o.status as OrderStatus)
      ).length;

      setSummary({
        totalSpent,
        ordersCount: (orders || []).filter((o) => o.status !== 'cancelled').length,
        activeOrdersCount,
        cashbackTotal: balance?.balance || 0,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, storeOwnerId]);

  return { ...summary, loading };
}
