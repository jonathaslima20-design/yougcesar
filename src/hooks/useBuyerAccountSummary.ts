import { useEffect, useState } from 'react';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { getBuyerTier, type BuyerTierInfo } from '@/lib/buyerTier';
import type { OrderStatus } from '@/types';

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipped'];

interface TopCashbackStore {
  storeOwnerId: string;
  name: string;
  balance: number;
}

export interface BuyerAccountSummary {
  totalSpent: number;
  tier: BuyerTierInfo;
  activeOrdersCount: number;
  cashbackTotal: number;
  topCashbackStore: TopCashbackStore | null;
  loading: boolean;
}

const EMPTY_SUMMARY: Omit<BuyerAccountSummary, 'loading'> = {
  totalSpent: 0,
  tier: getBuyerTier(0),
  activeOrdersCount: 0,
  cashbackTotal: 0,
  topCashbackStore: null,
};

export function useBuyerAccountSummary(customerId: string | undefined): BuyerAccountSummary {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [{ data: orders }, { data: balances }] = await Promise.all([
        supabaseBuyer.from('orders').select('status, total'),
        supabaseBuyer.from('cashback_balances').select('store_owner_id, balance').gt('balance', 0),
      ]);

      if (cancelled) return;

      const totalSpent = (orders || [])
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.total || 0), 0);
      const activeOrdersCount = (orders || []).filter((o) =>
        ACTIVE_STATUSES.includes(o.status as OrderStatus)
      ).length;
      const cashbackTotal = (balances || []).reduce((sum, b) => sum + (b.balance || 0), 0);

      const topBalance = (balances || []).sort((a, b) => b.balance - a.balance)[0] || null;
      let topCashbackStore: TopCashbackStore | null = null;
      if (topBalance) {
        const { data: store } = await supabaseBuyer
          .from('users')
          .select('name')
          .eq('id', topBalance.store_owner_id)
          .maybeSingle();
        if (!cancelled) {
          topCashbackStore = {
            storeOwnerId: topBalance.store_owner_id,
            name: store?.name || 'Loja',
            balance: topBalance.balance,
          };
        }
      }

      if (!cancelled) {
        setSummary({
          totalSpent,
          tier: getBuyerTier(totalSpent),
          activeOrdersCount,
          cashbackTotal,
          topCashbackStore,
        });
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return { ...summary, loading };
}
