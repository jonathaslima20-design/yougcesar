import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortOption } from './ListingsHeader';
import type { ProductTag } from '@/hooks/useProductTags';

interface ListingsFiltersProps {
  searchQuery: string;
  statusFilter: string;
  categoryFilter: string;
  sortOption: SortOption;
  availableCategories: string[];
  tags: ProductTag[];
  selectedTagIds: string[];
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: string) => void;
  onCategoryFilterChange: (category: string) => void;
  onSortChange: (sort: SortOption) => void;
  onTagFilterChange: (tagIds: string[]) => void;
}

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'visiveis', label: 'Visíveis' },
  { value: 'ocultos', label: 'Ocultos' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'display_order', label: 'Ordem personalizada' },
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'price_high', label: 'Maior preço' },
  { value: 'price_low', label: 'Menor preço' },
  { value: 'most_viewed', label: 'Mais visualizados' },
  { value: 'low_stock', label: 'Menor estoque' },
  { value: 'alpha', label: 'A-Z' },
];

export function ListingsFilters({
  searchQuery,
  statusFilter,
  categoryFilter,
  sortOption,
  availableCategories,
  tags,
  selectedTagIds,
  onSearchChange,
  onStatusFilterChange,
  onCategoryFilterChange,
  onSortChange,
  onTagFilterChange,
}: ListingsFiltersProps) {
  const hasActiveFilters = statusFilter !== 'todos' || categoryFilter !== 'todas' || selectedTagIds.length > 0;

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagFilterChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagFilterChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search + Sort row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, categoria ou marca..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Select value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter pills row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status filter pills */}
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onStatusFilterChange(opt.value)}
            className={`
              px-3 py-1 rounded-full text-xs font-medium transition-all
              ${statusFilter === opt.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
              }
            `}
          >
            {opt.label}
          </button>
        ))}

        {/* Category filter */}
        {availableCategories.length > 0 && (
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs rounded-full border-border/50 bg-muted/60">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {availableCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tag filter pills */}
        {tags.length > 0 && (
          <>
            <div className="w-px h-5 bg-border/50 mx-1 hidden sm:block" />
            {tags.slice(0, 5).map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`
                  px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border
                  ${selectedTagIds.includes(tag.id)
                    ? 'text-white border-transparent shadow-sm'
                    : 'border-border/50 text-muted-foreground hover:text-foreground bg-muted/40'
                  }
                `}
                style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
              >
                {tag.name}
              </button>
            ))}
          </>
        )}

        {/* Active filters badge */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              onStatusFilterChange('todos');
              onCategoryFilterChange('todas');
              onTagFilterChange([]);
            }}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
