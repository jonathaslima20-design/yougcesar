import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { formatCurrencyI18n } from '@/lib/i18n';
import { formatSizeLabel, getSizeTypeWithFallback } from '@/lib/sizeTypeUtils';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type FiltersPanelProps = Pick<
  StorefrontPageBodyProps,
  'allProducts' | 'filterMetadata' | 'filters' | 'onFiltersChange' | 'currency' | 'language' | 'settings' | 'sizeTypeMapping'
> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Independent copy of the storefront's product filter panel, purpose-built for the
 * Eletrônicos theme (triggered by "Todas Categorias" in the header, not by its own
 * button). Deliberately NOT shared with `ProductSearch.tsx` (the "padrão" theme's
 * search+filters component) — see feedback_dont_touch_shared_pages_casually: this
 * theme's UI must never risk changing the default theme's behavior. The two
 * components may drift over time; that's an accepted tradeoff for isolation.
 */
export default function EletronicosFiltersPanel({
  allProducts,
  filterMetadata,
  filters,
  onFiltersChange,
  currency = 'BRL',
  language = 'pt-BR',
  settings = {},
  sizeTypeMapping = {},
  open,
  onOpenChange,
}: FiltersPanelProps) {
  const configuredMinPrice = settings?.priceRange?.minPrice ?? 0;
  const configuredMaxPrice = settings?.priceRange?.maxPrice ?? 5000;

  const [localFilters, setLocalFilters] = useState(filters);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters?.minPrice ?? configuredMinPrice,
    filters?.maxPrice ?? configuredMaxPrice,
  ]);
  const [actualMinPrice, setActualMinPrice] = useState(configuredMinPrice);
  const [actualMaxPrice, setActualMaxPrice] = useState(configuredMaxPrice);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setPriceRange([filters?.minPrice ?? configuredMinPrice, filters?.maxPrice ?? configuredMaxPrice]);
    }
  }, [open]);

  useEffect(() => {
    const products = allProducts || [];
    if (products.length === 0) return;
    let minPrice = Infinity;
    let maxPrice = 0;
    products.forEach((product) => {
      if (product.has_tiered_pricing && product.min_tiered_price !== undefined && product.max_tiered_price !== undefined) {
        minPrice = Math.min(minPrice, product.min_tiered_price);
        maxPrice = Math.max(maxPrice, product.max_tiered_price);
      } else {
        const productPrice = product.discounted_price ?? product.price ?? 0;
        minPrice = Math.min(minPrice, productPrice);
        maxPrice = Math.max(maxPrice, productPrice);
      }
    });
    if (minPrice !== Infinity && maxPrice > 0) {
      setActualMinPrice(Math.floor(minPrice));
      setActualMaxPrice(Math.ceil(maxPrice));
    }
  }, [allProducts]);

  const categories = filterMetadata?.categories || [];
  const brands = filterMetadata?.brands || [];
  const genders = filterMetadata?.genders || [];
  const sizes = filterMetadata?.sizes || [];

  const groupedSizes: Record<string, string[]> = { apparel: [], shoe: [], custom: [] };
  sizes.forEach((size: string) => {
    groupedSizes[getSizeTypeWithFallback(size, sizeTypeMapping)].push(size);
  });

  const handleApply = () => {
    onFiltersChange({ ...localFilters, minPrice: priceRange[0], maxPrice: priceRange[1] });
    onOpenChange(false);
  };

  const handleClear = () => {
    const cleared = {
      ...localFilters,
      status: 'todos',
      category: 'todos',
      brand: 'todos',
      gender: 'todos',
      sizes: 'todos',
      condition: 'todos',
      minPrice: configuredMinPrice,
      maxPrice: configuredMaxPrice,
    };
    setLocalFilters(cleared);
    setPriceRange([configuredMinPrice, configuredMaxPrice]);
    onFiltersChange(cleared);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Refine sua busca usando os filtros abaixo</SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* No "Vendido"/"Reservado" status filter here on purpose — those are
              leftovers from the real-estate ("corretor") origin of this platform
              and don't make sense for a shopper browsing a store. `status` still
              defaults to 'todos' under the hood for the shared filter/search logic. */}

          {genders.length > 0 && (
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select
                value={localFilters?.gender || 'todos'}
                onValueChange={(value) => setLocalFilters((prev: any) => ({ ...prev, gender: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Gênero" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os gêneros</SelectItem>
                  {genders.map((gender: string) => (
                    <SelectItem key={gender} value={gender}>
                      {gender === 'masculino' ? 'Masculino' : gender === 'feminino' ? 'Feminino' : 'Unissex'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={localFilters?.category || 'todos'}
                onValueChange={(value) => setLocalFilters((prev: any) => ({ ...prev, category: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as categorias</SelectItem>
                  {categories.map((category: string) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {brands.length > 0 && (
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select
                value={localFilters?.brand || 'todos'}
                onValueChange={(value) => setLocalFilters((prev: any) => ({ ...prev, brand: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as marcas</SelectItem>
                  {brands.map((brand: string) => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="space-y-2">
              <Label>Tamanho</Label>
              <Select
                value={localFilters?.sizes || 'todos'}
                onValueChange={(value) => setLocalFilters((prev: any) => ({ ...prev, sizes: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Tamanho" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tamanhos</SelectItem>
                  {groupedSizes.apparel.map((size) => (
                    <SelectItem key={size} value={size}>{formatSizeLabel(size, 'apparel', language)}</SelectItem>
                  ))}
                  {groupedSizes.shoe.map((size) => (
                    <SelectItem key={size} value={size}>{formatSizeLabel(size, 'shoe', language)}</SelectItem>
                  ))}
                  {groupedSizes.custom.map((size) => (
                    <SelectItem key={size} value={size}>{formatSizeLabel(size, 'custom', language)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-4">
            <Label>Faixa de Preço</Label>
            <div className="px-2">
              <Slider
                min={actualMinPrice}
                max={actualMaxPrice}
                step={10}
                value={priceRange}
                onValueChange={(value) => setPriceRange([value[0], value[1]])}
              />
              <div className="flex justify-between mt-3 text-sm">
                <div className="text-center">
                  <div className="font-medium">{formatCurrencyI18n(priceRange[0], currency, language)}</div>
                  <div className="text-xs text-muted-foreground">Mínimo</div>
                </div>
                <div className="text-center">
                  <div className="font-medium">{formatCurrencyI18n(priceRange[1], currency, language)}</div>
                  <div className="text-xs text-muted-foreground">Máximo</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 pt-6 border-t gap-3">
          <Button variant="outline" onClick={handleClear}>Limpar Filtros</Button>
          <Button onClick={handleApply}>Aplicar Filtros</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
