import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { fetchFavorites } from '@/lib/buyerFavoritesService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton';
import type { Product } from '@/types';

interface StoreInfo {
  name: string;
  slug: string;
}

export default function BuyerFavoritesPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSlugByProductId, setStoreSlugByProductId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;

    (async () => {
      setLoading(true);
      const favorites = await fetchFavorites(customer.id);

      if (favorites.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const productIds = favorites.map((f) => f.product_id);
      const storeIds = [...new Set(favorites.map((f) => f.store_owner_id))];

      const [{ data: productRows }, { data: storeRows }] = await Promise.all([
        supabaseBuyer.from('products').select('*, product_images(*)').in('id', productIds),
        supabaseBuyer.from('users').select('id, name, slug').in('id', storeIds),
      ]);

      const storeById = new Map((storeRows || []).map((s: { id: string; name: string; slug: string }) => [s.id, s]));
      const slugMap: Record<string, string> = {};
      favorites.forEach((f) => {
        const store = storeById.get(f.store_owner_id);
        if (store) slugMap[f.product_id] = store.slug;
      });

      setStoreSlugByProductId(slugMap);
      // Favorites without a matching product (deleted since favorited) or
      // without a resolvable store slug can't render a working card — drop
      // them silently rather than show a broken link.
      setProducts((productRows || []).filter((p) => slugMap[p.id]) as Product[]);
      setLoading(false);
    })();
  }, [customer]);

  if (!authLoading && !customer) {
    return <Navigate to="/conta/entrar" state={{ from: '/conta/favoritos' }} replace />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Favoritos</h1>
        <p className="text-sm text-muted-foreground mt-1">Produtos que você salvou para comprar depois</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meus Favoritos</CardTitle>
        </CardHeader>
        <CardContent>
          {authLoading || loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {[0, 1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Heart className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Você ainda não favoritou nenhum produto.</p>
              <p className="text-sm mt-1">Toque no coração de um produto para salvá-lo aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} corretorSlug={storeSlugByProductId[product.id]} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
