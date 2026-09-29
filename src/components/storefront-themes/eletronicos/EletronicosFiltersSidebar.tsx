import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { formatCurrencyI18n } from '@/lib/i18n';
import { countOptions, type CatalogRow } from '@/components/storefront-themes/eletronicos/eletronicosCatalog';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type SidebarProps = Pick<StorefrontPageBodyProps, 'filters' | 'onFiltersChange' | 'currency' | 'language' | 'settings' | 'filterMetadata'> & {
  rows: CatalogRow[];
  priceRange: { min: number; max: number };
};

const GENDER_LABELS: Record<string, string> = { masculino: 'Masculino', feminino: 'Feminino', unissex: 'Unissex' };

function OptionList({
  title,
  options,
  counts,
  selected,
  onSelect,
  label = (value: string) => value,
}: {
  title: string;
  options: string[];
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (value: string | null) => void;
  label?: (value: string) => string;
}) {
  // Only options that would actually list something under the other active filters
  // (the selected one always stays, so it can be unselected), most products first.
  const visible = options
    .filter((option) => (counts.get(option) || 0) > 0 || selected === option)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  if (visible.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
        {visible.map((option) => {
          const count = counts.get(option) || 0;
          const isSelected = selected === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(isSelected ? null : option)}
              className={cn(
                'w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                isSelected ? 'bg-muted font-semibold' : 'hover:bg-muted/60'
              )}
            >
              <span className="truncate">{label(option)}</span>
              <span className="text-xs text-muted-foreground shrink-0">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Desktop filter column shown next to the product grid. Every click applies right away
 * (no "Aplicar" button) and each option shows how many products it would list given the
 * other active filters. The mobile equivalent is EletronicosFiltersPanel.
 */
export default function EletronicosFiltersSidebar({ filters, onFiltersChange, currency = 'BRL', language = 'pt-BR', settings, filterMetadata, rows, priceRange }: SidebarProps) {
  const configuredMin = settings?.priceRange?.minPrice ?? 0;
  const configuredMax = settings?.priceRange?.maxPrice ?? 5000;
  const hasRange = priceRange.max > priceRange.min;
  const clamp = (v: number) => Math.min(Math.max(v, priceRange.min), priceRange.max);

  const [price, setPrice] = useState<[number, number]>([priceRange.min, priceRange.max]);
  useEffect(() => {
    if (!hasRange) return;
    setPrice([clamp(filters?.minPrice ?? configuredMin), clamp(filters?.maxPrice ?? configuredMax)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.minPrice, filters?.maxPrice, priceRange.min, priceRange.max]);

  const set = (patch: Record<string, unknown>) => onFiltersChange({ ...filters, ...patch });
  const selectedOf = (key: 'category' | 'brand' | 'gender' | 'condition') =>
    filters?.[key] && filters[key] !== 'todos' ? (filters[key] as string) : null;
  const pick = (key: 'category' | 'brand' | 'gender' | 'condition') => (value: string | null) => set({ [key]: value ?? 'todos' });

  const defaults = priceRange;
  const commitPrice = ([min, max]: number[]) => {
    const full = min <= priceRange.min && max >= priceRange.max;
    set({ minPrice: full ? configuredMin : min, maxPrice: full ? configuredMax : max });
  };

  const categories = filterMetadata?.categories || [];
  const brands = filterMetadata?.brands || [];
  const genders = filterMetadata?.genders || [];

  return (
    <aside className="hidden lg:block w-60 shrink-0 space-y-6 pr-2" aria-label="Filtros">
      <OptionList
        title="Categorias"
        options={categories}
        counts={countOptions(rows, filters, 'category', defaults)}
        selected={selectedOf('category')}
        onSelect={pick('category')}
      />
      <OptionList
        title="Marca"
        options={brands}
        counts={countOptions(rows, filters, 'brand', defaults)}
        selected={selectedOf('brand')}
        onSelect={pick('brand')}
      />
      <OptionList
        title="Gênero"
        options={genders}
        counts={countOptions(rows, filters, 'gender', defaults)}
        selected={selectedOf('gender')}
        onSelect={pick('gender')}
        label={(g) => GENDER_LABELS[g] || g}
      />

      {hasRange && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Preço</h3>
          <div className="px-1">
            <Slider
              min={priceRange.min}
              max={priceRange.max}
              step={Math.max(1, Math.round((priceRange.max - priceRange.min) / 100))}
              value={price}
              onValueChange={(v) => setPrice([v[0], v[1]])}
              onValueCommit={commitPrice}
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{formatCurrencyI18n(price[0], currency, language)}</span>
              <span>{formatCurrencyI18n(price[1], currency, language)}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
