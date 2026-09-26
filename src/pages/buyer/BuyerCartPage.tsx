import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Store, Loader } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { useBuyerStore } from '@/contexts/BuyerStoreContext';
import CartModal from '@/components/corretor/CartModal';
import type { User } from '@/types';
import type { SupportedCurrency, SupportedLanguage } from '@/lib/i18n';

// Renders the real storefront CartModal for the store whose buyer area this is
// (the store in the URL), instead of re-building checkout from scratch.
export default function BuyerCartPage() {
  const { cart } = useCart();
  const navigate = useNavigate();
  const { store: buyerStore, path } = useBuyerStore();
  const [store, setStore] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const hasItems = cart.items.length > 0 || cart.distributions.length > 0;
  const storeSlug = buyerStore?.slug;

  useEffect(() => {
    if (!hasItems || !storeSlug) return;

    let cancelled = false;
    setLoading(true);
    supabaseBuyer
      .from('users')
      .select('*')
      .eq('slug', storeSlug)
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
  }, [hasItems, storeSlug]);

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

  if (!storeSlug || notFound) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl">
        <h1 className="text-2xl md:text-3xl page-title mb-6">Meu Carrinho</h1>
        <div className="text-center py-16 text-muted-foreground">
          <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Você tem {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'itens'} no carrinho, mas não conseguimos carregar esta loja.</p>
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
        if (!open) navigate(path('/pedidos'));
      }}
      corretor={store}
      currency={(store.currency as SupportedCurrency) || 'BRL'}
      language={(store.language as SupportedLanguage) || 'pt-BR'}
    />
  );
}
