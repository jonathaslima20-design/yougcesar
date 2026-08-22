import { useState, useEffect } from 'react';
import { getMerchantPaymentConfig } from '@/lib/merchantPayments';

// Whether this merchant's own Mercado Pago credentials are tested and active
// (merchant_payment_credentials.is_active) — independent of the platform-wide
// kill switch checked by usePlatformPaymentsEnabled. Used to gate the
// "Ativar pagamento online" switch in Regras de Pedido so it can't be turned
// on before there's a real payment gateway behind it.
export function useMerchantPaymentActive(userId?: string) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { config } = await getMerchantPaymentConfig();
        if (!cancelled) setActive(!!config?.is_active);
      } catch {
        if (!cancelled) setActive(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { active, loading };
}
