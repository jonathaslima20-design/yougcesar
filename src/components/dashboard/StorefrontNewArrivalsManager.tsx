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
  price: number | null;
  discounted_price: number | null;
  flag: boolean;
}

interface StorefrontProductPickerManagerProps {
  /** products column holding the merchant's on/off flag for this section. */
  column: 'storefront_featured' | 'storefront_offer';
  /** Warn on rows without a real markdown (used by "Ofertas"). */
  requireDiscount?: boolean;
}

export function StorefrontProductPickerManager({ column, requireDiscount = false }: StorefrontProductPickerManagerProps) {
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
      .select(`id, title, featured_image_url, price, discounted_price, ${column}`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(`Error fetching products for ${column}:`, error);
          setProducts([]);
        } else {
          setProducts(
            ((data || []) as unknown as Array<Record<string, any>>).map((row) => ({
              id: row.id,
              title: row.title,
              featured_image_url: row.featured_image_url,
              price: row.price,
              discounted_price: row.discounted_price,
              flag: !!row[column],
            }))
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, column]);

  const handleToggle = async (product: ProductRow) => {
    setBusyId(product.id);
    const { error } = await supabase
      .from('products')
      .update({ [column]: !product.flag })
      .eq('id', product.id);
    setBusyId(null);
    if (error) {
      toast.error('Erro ao atualizar produto');
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, flag: !p.flag } : p)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedCount = products.filter((p) => p.flag).length;
  const hasDiscount = (p: ProductRow) =>
    p.discounted_price != null && p.discounted_price > 0 && p.discounted_price < (p.price ?? 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Escolha quais produtos aparecem
        {selectedCount > 0 ? ` (${selectedCount} selecionado${selectedCount > 1 ? 's' : ''}).` : '.'}
        {selectedCount === 0 ? ' Enquanto nenhum for selecionado, a seção fica oculta na loja.' : ''}
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
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{product.title}</span>
                  {requireDiscount && product.flag && !hasDiscount(product) && (
                    <span className="block text-xs text-amber-600">
                      Sem preço promocional — o card não mostrará desconto.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={product.flag}
                    onCheckedChange={() => handleToggle(product)}
                    disabled={busyId === product.id}
                  />
                  <span className="text-xs text-muted-foreground w-16">
                    {product.flag ? 'Em destaque' : 'Oculto'}
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

export function StorefrontNewArrivalsManager() {
  return <StorefrontProductPickerManager column="storefront_featured" />;
}

export function StorefrontOffersManager() {
  return <StorefrontProductPickerManager column="storefront_offer" requireDiscount />;
}
