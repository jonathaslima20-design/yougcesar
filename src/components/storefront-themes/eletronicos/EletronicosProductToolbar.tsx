import { SlidersHorizontal, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ELETRONICOS_SORT_OPTIONS, type EletronicosSortKey } from '@/components/storefront-themes/eletronicos/eletronicosSort';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type ToolbarProps = Pick<StorefrontPageBodyProps, 'filters' | 'onFiltersChange'> & {
  onOpenFilters: () => void;
  sortBy: EletronicosSortKey;
  onSortChange: (value: EletronicosSortKey) => void;
};

const GENDER_LABELS: Record<string, string> = { masculino: 'Masculino', feminino: 'Feminino', unissex: 'Unissex' };

/**
 * Bar above the product grid (browse view only): "Filtros" button, "Ordenar por", and
 * one removable chip per active filter — so a shopper always sees what is narrowing the
 * list and can drop a single filter without reopening the panel.
 */
export default function EletronicosProductToolbar({ filters, onFiltersChange, onOpenFilters, sortBy, onSortChange }: ToolbarProps) {
  const clear = (patch: Record<string, unknown>) => onFiltersChange({ ...filters, ...patch });

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters?.query) chips.push({ key: 'query', label: `Busca: ${filters.query}`, onRemove: () => clear({ query: '' }) });
  if (filters?.category && filters.category !== 'todos') chips.push({ key: 'category', label: filters.category, onRemove: () => clear({ category: 'todos' }) });
  if (filters?.brand && filters.brand !== 'todos') chips.push({ key: 'brand', label: filters.brand, onRemove: () => clear({ brand: 'todos' }) });
  if (filters?.gender && filters.gender !== 'todos') chips.push({ key: 'gender', label: GENDER_LABELS[filters.gender] || filters.gender, onRemove: () => clear({ gender: 'todos' }) });
  if (filters?.sizes && filters.sizes !== 'todos') chips.push({ key: 'sizes', label: `Tamanho ${filters.sizes}`, onRemove: () => clear({ sizes: 'todos' }) });
  if (filters?.condition && filters.condition !== 'todos') chips.push({ key: 'condition', label: filters.condition, onRemove: () => clear({ condition: 'todos' }) });

  return (
    <div className="container mx-auto px-4 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center gap-2 rounded-md border px-3 h-9 text-sm font-medium hover:bg-muted/60"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-muted-foreground">Ordenar por</span>
          <Select value={sortBy} onValueChange={(value) => onSortChange(value as EletronicosSortKey)}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Ordenar produtos">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELETRONICOS_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted/70"
              aria-label={`Remover filtro ${chip.label}`}
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
