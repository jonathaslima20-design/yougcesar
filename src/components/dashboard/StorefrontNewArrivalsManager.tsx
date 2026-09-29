import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface ProductRow {
  id: string;
  title: string;
  featured_image_url: string | null;
  storefront_featured: boolean;
}

export function StorefrontNewArrivalsManager() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('products')
      .select('id, title, featured_image_url, storefront_featured')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching products for Novidades:', error);
          setProducts([]);
        } else {
          setProducts((data || []) as ProductRow[]);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleToggle = async (product: ProductRow) => {
    setBusyId(product.id);
    const { error } = await supabase
      .from('products')
      .update({ storefront_featured: !product.storefront_featured })
      .eq('id', product.id);
    setBusyId(null);
    if (error) {
      toast.error('Erro ao atualizar produto');
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, storefront_featured: !p.storefront_featured } : p))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const featuredCount = products.filter((p) => p.storefront_featured).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Escolha quais produtos aparecem
        {featuredCount > 0 ? ` (${featuredCount} selecionado${featuredCount > 1 ? 's' : ''}).` : '.'}
      </p>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não tem produtos cadastrados.</p>
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="h-12 w-12 rounded border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {product.featured_image_url ? (
                    <img src={product.featured_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sem foto</span>
                  )}
                </div>
                <span className="flex-1 text-sm font-medium truncate">{product.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={product.storefront_featured}
                    onCheckedChange={() => handleToggle(product)}
                    disabled={busyId === product.id}
                  />
                  <span className="text-xs text-muted-foreground w-16">
                    {product.storefront_featured ? 'Em destaque' : 'Oculto'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
