import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AppliedCoupon } from '@/types';

export function useCouponValidation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const validateCoupon = useCallback(async (
    storeOwnerId: string,
    code: string,
    customerWhatsapp: string,
    cartTotal: number,
    productIds: string[]
  ): Promise<AppliedCoupon | null> => {
    if (!code.trim()) {
      setError('Informe o codigo do cupom');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('validate_coupon', {
        p_store_owner_id: storeOwnerId,
        p_code: code.trim(),
        p_customer_whatsapp: customerWhatsapp || '',
        p_cart_total: cartTotal,
        p_product_ids: productIds,
      });

      if (rpcError) throw rpcError;

      if (!data?.valid) {
        setError(data?.error_message || 'Cupom invalido');
        setAppliedCoupon(null);
        return null;
      }

      const coupon: AppliedCoupon = {
        couponId: data.coupon_id,
        code: data.code,
        name: data.name,
        discountType: data.discount_type,
        discountValue: data.discount_value,
        calculatedDiscount: data.calculated_discount,
      };

      setAppliedCoupon(coupon);
      setError(null);
      return coupon;
    } catch (err) {
      console.error('Error validating coupon:', err);
      setError('Erro ao validar cupom');
      setAppliedCoupon(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    appliedCoupon,
    validateCoupon,
    clearCoupon,
    setError,
  };
}
