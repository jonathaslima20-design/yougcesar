import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';

// The buyer area used to live at /conta/* for the whole platform. It now lives
// inside each store (/:slug/conta/*), so old links (e-mails, bookmarks) land
// here and are forwarded to the right store:
//   - /conta/pedidos/:id  -> the store that order belongs to
//   - anything else       -> the store where the buyer has the most recent account
// Only the buyer's own data is consulted, and nothing about other stores is shown.
export default function LegacyContaRedirect() {
  const location = useLocation();
  const { customer, loading: authLoading } = useBuyerAuth();
  const [target, setTarget] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const sub = location.pathname.replace(/^\/conta/, '') + location.search;

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;

    (async () => {
      let storeId: string | null = null;

      const orderMatch = location.pathname.match(/^\/conta\/pedidos\/([^/]+)/);
      if (orderMatch) {
        const { data } = await supabaseBuyer
          .from('orders')
          .select('store_owner_id')
          .eq('id', orderMatch[1])
          .maybeSingle();
        storeId = data?.store_owner_id ?? null;
      }

      if (!storeId) {
        const { data } = await supabaseBuyer
          .from('customer_store_accounts')
          .select('store_owner_id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        storeId = data?.store_owner_id ?? null;
      }

      // Fallback when the buyer has no store account yet: the store of their latest order.
      if (!storeId) {
        const { data } = await supabaseBuyer
          .from('orders')
          .select('store_owner_id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        storeId = data?.store_owner_id ?? null;
      }

      if (!storeId) {
        if (!cancelled) setFailed(true);
        return;
      }

      const { data: store } = await supabaseBuyer.from('users').select('slug').eq('id', storeId).maybeSingle();
      if (cancelled) return;
      if (store?.slug) setTarget(`/${store.slug}/conta${sub}`);
      else setFailed(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, location.pathname]);

  if (!authLoading && !customer) {
    return <Navigate to="/conta/entrar" state={{ from: location.pathname }} replace />;
  }
  if (failed) return <Navigate to="/" replace />;
  if (target) return <Navigate to={target} replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
