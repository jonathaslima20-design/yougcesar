import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useProductFilterMetadata } from '@/hooks/useProductFilterMetadata';
import { cn } from '@/lib/utils';
import { parseBannerLink, serializeBannerLink, type BannerLinkType } from '@/lib/bannerLink';

interface BannerLinkFieldProps {
  /** The stored `link_url` value (see lib/bannerLink.ts). */
  value: string | null | undefined;
  /** Called with the new `link_url` value (null = no link). */
  onChange: (value: string | null) => void;
  disabled?: boolean;
  label?: string;
}

const TYPE_LABELS: Record<BannerLinkType, string> = {
  none: 'Sem link',
  url: 'Link externo',
  category: 'Categoria da loja',
  product: 'Produto',
};

interface ProductOption {
  id: string;
  title: string;
}

/**
 * "What happens on click" for a banner: nothing, an external URL, a category of the
 * store, or one specific product. Categories and products come from the merchant's own
 * catalog. Saves as soon as a valid choice is made (URLs on blur).
 */
export function BannerLinkField({ value, onChange, disabled, label = 'Ao clicar' }: BannerLinkFieldProps) {
  const { user } = useAuth();
  const parsed = parseBannerLink(value);
  const [type, setType] = useState<BannerLinkType>(parsed.type);
  const [urlText, setUrlText] = useState(parsed.type === 'url' ? parsed.value : '');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { metadata } = useProductFilterMetadata({ userId: user?.id || '', enabled: !!user?.id && type === 'category' });

  // Keep the local form in sync when the stored value changes from outside (e.g. after a reload).
  useEffect(() => {
    const next = parseBannerLink(value);
    setType(next.type);
    if (next.type === 'url') setUrlText(next.value);
  }, [value]);

  useEffect(() => {
    if (type !== 'product' || productsLoaded || !user?.id) return;
    let cancelled = false;
    supabase
      .from('products')
      .select('id, title')
      .eq('user_id', user.id)
      .order('title', { ascending: true })
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return;
        setProducts((data || []) as ProductOption[]);
        setProductsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [type, productsLoaded, user?.id]);

  const changeType = (next: BannerLinkType) => {
    setType(next);
    if (next === 'none') onChange(null);
    // The other types wait for a concrete choice before saving anything.
  };

  const selectedProduct = products.find((p) => p.id === parsed.value);
  const categories = metadata.categories;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground block">{label}</Label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={type} onValueChange={(v) => changeType(v as BannerLinkType)} disabled={disabled}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as BannerLinkType[]).map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {type === 'url' && (
          <Input
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            onBlur={() => onChange(serializeBannerLink({ type: 'url', value: urlText }))}
            placeholder="https://..."
            disabled={disabled}
            className="flex-1"
          />
        )}

        {type === 'category' && (
          <Select
            value={parsed.type === 'category' ? parsed.value : ''}
            onValueChange={(v) => onChange(serializeBannerLink({ type: 'category', value: v }))}
            disabled={disabled}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={categories.length === 0 ? 'Nenhuma categoria cadastrada' : 'Escolha a categoria'} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {type === 'product' && (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox" disabled={disabled} className="flex-1 justify-between font-normal">
                <span className="truncate">
                  {parsed.type === 'product'
                    ? selectedProduct?.title || (productsLoaded ? 'Produto não encontrado' : 'Carregando...')
                    : 'Escolha o produto'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
              <Command>
                <CommandInput placeholder="Buscar produto..." />
                <CommandList>
                  <CommandEmpty>{productsLoaded ? 'Nenhum produto encontrado.' : 'Carregando...'}</CommandEmpty>
                  <CommandGroup>
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={`${product.title} ${product.id}`}
                        onSelect={() => {
                          onChange(serializeBannerLink({ type: 'product', value: product.id }));
                          setPickerOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', parsed.value === product.id ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{product.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
