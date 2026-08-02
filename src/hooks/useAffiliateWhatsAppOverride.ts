import { useEffect, useState } from 'react';
import { resolveAffiliateWhatsAppOverride, type WhatsAppContactOverride } from '@/lib/affiliateUtils';

/**
 * Resolves (async, non-blocking) whether the current storefront visitor
 * should see the attributed affiliate's own WhatsApp number instead of the
 * store's default. Returns null while loading or when no override applies.
 */
export function useAffiliateWhatsAppOverride(storeOwnerId?: string | null): WhatsAppContactOverride | null {
  const [override, setOverride] = useState<WhatsAppContactOverride | null>(null);

  useEffect(() => {
    if (!storeOwnerId) {
      setOverride(null);
      return;
    }
    let cancelled = false;
    resolveAffiliateWhatsAppOverride(storeOwnerId).then((result) => {
      if (!cancelled) setOverride(result);
    });
    return () => {
      cancelled = true;
    };
  }, [storeOwnerId]);

  return override;
}
