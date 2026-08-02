import { useEffect, useMemo, useState } from 'react';
import { Loader, Package, Copy, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';
import { supabaseAffiliate } from '@/lib/supabaseAffiliate';
import { generateAffiliateProductLink, generateAffiliateCategoryLink } from '@/lib/affiliateUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ProductRow {
  id: string;
  title: string;
  price: number | null;
  discounted_price: number | null;
  category: string[] | null;
  featured_image_url: string | null;
}

interface CommissionRule {
  category_name: string | null;
  commission_percentage: number;
}

export default function AffiliateCatalogPage() {
  const { affiliate } = useAffiliateAuth();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliate) return;
    const load = async () => {
      setLoading(true);
      try {
        const [storeRes, productsRes, rulesRes] = await Promise.all([
          supabaseAffiliate.from('users').select('slug').eq('id', affiliate.store_owner_id).maybeSingle(),
          supabaseAffiliate
            .from('products')
            .select('id, title, price, discounted_price, category, featured_image_url')
            .eq('user_id', affiliate.store_owner_id)
            .eq('is_visible_on_storefront', true)
            .order('title', { ascending: true }),
          supabaseAffiliate
            .from('affiliate_commission_rules')
            .select('category_name, commission_percentage')
            .eq('affiliate_id', affiliate.id),
        ]);
        setStoreSlug(storeRes.data?.slug || null);
        setProducts(productsRes.data || []);
        setRules(rulesRes.data || []);
      } catch (err) {
        console.error('Error loading affiliate catalog:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [affiliate]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => (p.category || []).forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [products]);

  const handleCopyProductLink = (productId: string) => {
    if (!storeSlug || !affiliate) return;
    navigator.clipboard.writeText(generateAffiliateProductLink(storeSlug, productId, affiliate.affiliate_code));
    toast.success('Link do produto copiado');
  };

  const handleCopyCategoryLink = (categoryName: string) => {
    if (!storeSlug || !affiliate) return;
    navigator.clipboard.writeText(generateAffiliateCategoryLink(storeSlug, categoryName, affiliate.affiliate_code));
    toast.success('Link da categoria copiado');
  };

  const effectiveRate = useMemo(() => {
    return (productCategories: string[] | null): number => {
      if (!affiliate) return 0;
      if (productCategories && productCategories.length > 0) {
        const matching = rules
          .filter(r => r.category_name && productCategories.includes(r.category_name))
          .map(r => r.commission_percentage);
        if (matching.length > 0) return Math.max(...matching);
      }
      return affiliate.default_commission_percentage;
    };
  }, [affiliate, rules]);

  const sortedProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => (p.category || []).includes(selectedCategory));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => effectiveRate(b.category) - effectiveRate(a.category));
  }, [products, search, selectedCategory, effectiveRate]);

  if (!affiliate) return null;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Produtos da loja, ordenados pela sua comissão — divulgue os que rendem mais.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCategory !== 'all' && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">Link direto da categoria <strong>{selectedCategory}</strong></span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => handleCopyCategoryLink(selectedCategory)}>
            <Copy className="h-3.5 w-3.5" />
            Copiar link
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sortedProducts.map((p) => {
            const rate = effectiveRate(p.category);
            const price = p.discounted_price ?? p.price ?? 0;
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {p.featured_image_url ? (
                    <img src={p.featured_image_url} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(price)}</p>
                  <div className="flex items-center justify-between gap-1">
                    <Badge className="text-xs">{rate}% de comissão</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopyProductLink(p.id)}
                      title="Copiar link do produto"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
