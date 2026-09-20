import { useEffect, useState } from 'react';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { getLastVisitedStore } from '@/lib/lastVisitedStore';

// The buyer account area (/conta/*) isn't scoped to one store, but per
// product decision the buyer always arrives there via some store's
// CorretorPage first — so "cashback available" for the account-wide nav
// (sidebar item, Visão Geral card) is decided by whether the last store the
// buyer visited actually offers it, mirroring the same admin-gate +
// merchant-toggle check the storefront itself uses (see useCheckoutSettings.ts).
export function useLastStoreCashbackEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const slug = getLastVisitedStore();
    if (!slug) {
      setEnabled(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data: store } = await supabaseBuyer
        .from('users')
        .select('id, cashback_enabled')
        .eq('slug', slug)
        .maybeSingle();

      if (cancelled) return;
      if (!store?.cashback_enabled) {
        setEnabled(false);
        return;
      }

      const { data: settingsRow } = await supabaseBuyer
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', store.id)
        .maybeSingle();

      if (!cancelled) {
        setEnabled(!!settingsRow?.settings?.checkout?.cashback?.enabled);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
