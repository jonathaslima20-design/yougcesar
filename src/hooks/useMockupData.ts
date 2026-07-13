import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface MockupProduct {
  id: string;
  name: string;
  price: number;
  discount_price: number | null;
  featured_image_url: string | null;
  short_description: string | null;
}

interface MockupData {
  name: string;
  bio: string;
  avatar_url: string | null;
  cover_url_mobile: string | null;
  promotional_banner_url_mobile: string | null;
  whatsapp: string | null;
  instagram: string | null;
  phone: string | null;
  location: string | null;
  products: MockupProduct[];
  categoryName: string;
  loading: boolean;
}

export function useMockupData(): MockupData {
  const { user } = useAuth();
  const [products, setProducts] = useState<MockupProduct[]>([]);
  const [categoryName, setCategoryName] = useState('Produtos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      let firstCategory = 'Produtos';
      try {
        const categoriesResult = await supabase
          .from('user_product_categories')
          .select('name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);

        if (categoriesResult.data && categoriesResult.data.length > 0) {
          firstCategory = categoriesResult.data[0].name;
          setCategoryName(firstCategory);
        }
      } catch {
        // fallback to default category name
      }

      const productsQuery = supabase
        .from('products')
        .select('id, title, price, discounted_price, featured_image_url, category, short_description')
        .eq('user_id', user.id)
        .eq('status', 'disponivel')
        .order('display_order', { ascending: true })
        .limit(4);

      if (firstCategory !== 'Produtos') {
        productsQuery.contains('category', [firstCategory]);
      }

      const productsResult = await productsQuery;

      if (productsResult.data) {
        setProducts(productsResult.data.map(p => ({
          id: p.id,
          name: p.title,
          price: Number(p.price),
          discount_price: p.discounted_price ? Number(p.discounted_price) : null,
          featured_image_url: p.featured_image_url,
          short_description: p.short_description || null,
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  return {
    name: user?.name || 'Minha Loja',
    bio: user?.bio || 'Confira nossos produtos incriveis!',
    avatar_url: user?.avatar_url || null,
    cover_url_mobile: user?.cover_url_mobile || user?.cover_url || null,
    promotional_banner_url_mobile: user?.promotional_banner_url_mobile || null,
    whatsapp: user?.whatsapp || null,
    instagram: user?.instagram || null,
    phone: user?.phone || null,
    location: user?.location || null,
    products,
    categoryName,
    loading,
  };
}
