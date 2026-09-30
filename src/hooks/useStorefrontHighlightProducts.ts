import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

const HIGHLIGHT_PRODUCTS_SELECT = `
  id,
  title,
  price,
  discounted_price,
  is_starting_price,
  featured_image_url,
  status,
  category,
  display_order,
  has_tiered_pricing,
  min_tiered_price,
  max_tiered_price,
  short_description,
  colors,
  sizes,
  flavors,
  has_weight_variants,
  min_variant_price,
  max_variant_price,
  external_checkout_url,
  track_inventory,
  stock_quantity,
  low_stock_threshold,
  product_images (
    id,
    url,
    associated_color
  )
`;

/** Products the merchant hand-picked for "Destaques" (products.storefront_highlight). */
export function useStorefrontHighlightProducts(userId: string | undefined) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('products')
      .select(HIGHLIGHT_PRODUCTS_SELECT)
      .eq('user_id', userId)
      .eq('is_visible_on_storefront', true)
      .eq('storefront_highlight', true)
      .order('display_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching storefront highlight products:', error);
          setProducts([]);
        } else {
          setProducts((data || []) as unknown as Product[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { products, loading };
}
