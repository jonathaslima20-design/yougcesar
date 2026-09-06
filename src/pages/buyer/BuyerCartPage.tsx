import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Store, Loader } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { getLastVisitedStore } from '@/lib/lastVisitedStore';
import CartModal from '@/components/corretor/CartModal';
import type { User } from '@/types';
import type { SupportedCurrency, SupportedLanguage } from '@/lib/i18n';

// The account area has no store of its own — the cart it shows is whichever
// store's cart is active (cart items aren't tagged with a store, matching
// CartContext's existing single-active-cart model). We resolve that store
// from the last one visited in this browser tab (same signal
// BuyerAccountSidebar already uses for its header logo), reusing the real
// storefront CartModal instead of re-building checkout from scratch.
export default function BuyerCartPage() {
  const { cart } = useCart();
  const navigate = useNavigate();
  const [store, setStore] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const hasItems = cart.items.length > 0 || cart.distributions.length > 0;
  const lastStoreSlug = getLastVisitedStore();

  useEffect(() => {
    if (!hasItems || !lastStoreSlug) return;

    let cancelled = false;
    setLoading(true);
    supabaseBuyer
      .from('users')
      .select('*')
      .eq('slug', lastStoreSlug)
      .eq('role', 'corretor')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setStore(data as User);
        else setNotFound(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasItems, lastStoreSlug]);

  if (!hasItems) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl">
        <h1 className="text-2xl md:text-3xl page-title mb-6">Meu Carrinho</h1>
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Seu carrinho está vazio.</p>
        </div>
      </div>
    );
  }

  if (!lastStoreSlug || notFound) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl">
        <h1 className="text-2xl md:text-3xl page-title mb-6">Meu Carrinho</h1>
        <div className="text-center py-16 text-muted-foreground">
          <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Você tem {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'itens'} no carrinho, mas não conseguimos identificar a loja neste dispositivo.</p>
          <p className="text-sm mt-1">Abra a loja onde você estava comprando para continuar.</p>
        </div>
      </div>
    );
  }

  if (loading || !store) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl flex justify-center py-16">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <CartModal
      open
      onOpenChange={(open) => {
        if (!open) navigate('/conta/pedidos');
      }}
      corretor={store}
      currency={(store.currency as SupportedCurrency) || 'BRL'}
      language={(store.language as SupportedLanguage) || 'pt-BR'}
    />
  );
}
