import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { useBuyerAuth } from './BuyerAuthContext';
import { fetchFavorites, addFavorite, removeFavorite } from '@/lib/buyerFavoritesService';
import type { Product } from '@/types';

interface FavoritesContextType {
  favoriteIds: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Pick<Product, 'id' | 'user_id'>) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

// Loads the buyer's favorited product ids once (on login) and keeps them in
// memory so every ProductCard on a catalog page can check/toggle favorite
// status without each running its own query.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { customer } = useBuyerAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!customer) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    fetchFavorites(customer.id)
      .then((rows) => {
        if (!cancelled) setFavoriteIds(new Set(rows.map((r) => r.product_id)));
      })
      .catch(() => {
        // Keep an empty set on failure — the heart just reads as "not
        // favorited" rather than blocking the storefront from rendering.
      });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  const isFavorite = useCallback((productId: string) => favoriteIds.has(productId), [favoriteIds]);

  const toggleFavorite = useCallback(
    async (product: Pick<Product, 'id' | 'user_id'>) => {
      if (!customer) {
        toast.error('Entre na sua conta para favoritar produtos');
        return;
      }

      const wasFavorite = favoriteIds.has(product.id);

      // Optimistic update — a heart toggle should feel instant.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(product.id);
        else next.add(product.id);
        return next;
      });

      try {
        if (wasFavorite) {
          await removeFavorite(customer.id, product.id);
        } else {
          await addFavorite(customer.id, product.id, product.user_id);
        }
      } catch {
        // Roll back on failure
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(product.id);
          else next.delete(product.id);
          return next;
        });
        toast.error('Não foi possível atualizar seus favoritos. Tente novamente.');
      }
    },
    [customer, favoriteIds]
  );

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextType {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
