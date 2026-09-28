import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface StorefrontCategoryImage {
  id: string;
  user_id: string;
  category: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export function useStorefrontCategoryImages(userId: string | undefined) {
  const [images, setImages] = useState<StorefrontCategoryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setImages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('storefront_category_images')
      .select('*')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching storefront category images:', error);
          setImages([]);
        } else {
          setImages((data || []) as StorefrontCategoryImage[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const getImage = useCallback(
    (category: string) => images.find((i) => i.category === category)?.image_url,
    [images]
  );

  const setImage = useCallback(async (userId: string, category: string, imageUrl: string): Promise<boolean> => {
    const { error } = await supabase
      .from('storefront_category_images')
      .upsert({ user_id: userId, category, image_url: imageUrl, updated_at: new Date().toISOString() }, { onConflict: 'user_id,category' });
    if (error) {
      console.error('Error saving storefront category image:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  const removeImage = useCallback(async (userId: string, category: string): Promise<boolean> => {
    const { error } = await supabase
      .from('storefront_category_images')
      .delete()
      .eq('user_id', userId)
      .eq('category', category);
    if (error) {
      console.error('Error removing storefront category image:', error);
      return false;
    }
    refresh();
    return true;
  }, [refresh]);

  return { images, loading, getImage, setImage, removeImage, refresh };
}
