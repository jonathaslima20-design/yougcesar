import { useEffect, useState } from 'react';
import { supabaseBuyer } from '@/lib/supabaseBuyer';

export interface CustomerCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_order_value: number;
  max_discount_amount: number | null;
  valid_until: string | null;
  applies_to: string;
}

// Coupons the merchant explicitly chose to show buyers (coupons.show_to_customers).
// Fails soft (empty list) so the Visão Geral works on databases where the
// migration isn't applied yet.
export function useCustomerCoupons(storeSlug: string | undefined) {
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeSlug) return;
    let cancelled = false;
    setLoading(true);
    supabaseBuyer
      .rpc('list_customer_visible_coupons', { p_store_slug: storeSlug })
      .then(({ data, error }) => {
        if (cancelled) return;
        setCoupons(error ? [] : (data as CustomerCoupon[]) || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  return { coupons, loading };
}
