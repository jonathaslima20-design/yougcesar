import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { joinStore } from '@/lib/buyerStore';

// The buyer area (/:slug/conta/*) always belongs to exactly ONE store: the one
// in the URL. Every page reads the store from here and only ever queries that
// store's data, so a buyer's account looks like it lives inside each store
// separately (no cross-store totals, "last store" or favorites).
export interface BuyerStore {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
}

interface BuyerStoreContextType {
  store: BuyerStore | null;
  loading: boolean;
  notFound: boolean;
  // The store lookup itself failed (network/auth hiccup) — different from not found.
  loadFailed: boolean;
  retry: () => void;
  // Admin gate (users.cashback_enabled) AND the merchant's own toggle — the
  // same check the storefront applies (see useCheckoutSettings.ts).
  cashbackEnabled: boolean;
  // Merchant-configured % of each paid order returned as cashback (0 when disabled).
  cashbackRate: number;
  // When the buyer's account in THIS store was created (not the platform signup).
  customerSince: string | null;
  // Absolute path inside this store's buyer area, e.g. path('/pedidos').
  path: (sub?: string) => string;
  // Login page for this store, keeping the store's branding.
  loginPath: string;
}

const BuyerStoreContext = createContext<BuyerStoreContextType | undefined>(undefined);

export function BuyerStoreProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { customer } = useBuyerAuth();
  const [store, setStore] = useState<BuyerStore | null>(null);
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackRate, setCashbackRate] = useState(0);
  const [customerSince, setCustomerSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadFailed(false);
    setStore(null);
    setCashbackEnabled(false);
    setCashbackRate(0);

    (async () => {
      const { data, error } = await supabaseBuyer
        .from('users')
        .select('id, slug, name, avatar_url, cashback_enabled')
        .eq('slug', slug)
        .eq('role', 'corretor')
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setLoadFailed(true);
        setLoading(false);
        return;
      }
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setStore({ id: data.id, slug: data.slug, name: data.name, avatar_url: data.avatar_url });

      let enabled = false;
      let rate = 0;
      if (data.cashback_enabled) {
        const { data: settingsRow } = await supabaseBuyer
          .from('user_storefront_settings')
          .select('settings')
          .eq('user_id', data.id)
          .maybeSingle();
        const cashback = settingsRow?.settings?.checkout?.cashback;
        enabled = !!cashback?.enabled;
        rate = enabled ? Number(cashback?.percentageRate) || 0 : 0;
      }

      if (cancelled) return;
      setCashbackEnabled(enabled);
      setCashbackRate(rate);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  // Opening a store's buyer area while signed in makes sure the buyer has an
  // account there (idempotent) — the login itself is shared, the account is not.
  useEffect(() => {
    if (!customer || !store) {
      setCustomerSince(null);
      return;
    }
    let cancelled = false;
    (async () => {
      await joinStore(store.slug);
      const { data } = await supabaseBuyer
        .from('customer_store_accounts')
        .select('created_at')
        .eq('store_owner_id', store.id)
        .maybeSingle();
      if (!cancelled) setCustomerSince(data?.created_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [customer?.id, store]);

  const value = useMemo<BuyerStoreContextType>(
    () => ({
      store,
      loading,
      notFound,
      loadFailed,
      retry: () => setAttempt((n) => n + 1),
      cashbackEnabled,
      cashbackRate,
      customerSince,
      path: (sub = '') => `/${slug}/conta${sub}`,
      loginPath: `/conta/entrar?loja=${slug}`,
    }),
    [store, loading, notFound, loadFailed, cashbackEnabled, cashbackRate, customerSince, slug]
  );

  return <BuyerStoreContext.Provider value={value}>{children}</BuyerStoreContext.Provider>;
}

export function useBuyerStore(): BuyerStoreContextType {
  const ctx = useContext(BuyerStoreContext);
  if (!ctx) throw new Error('useBuyerStore must be used within BuyerStoreProvider');
  return ctx;
}
