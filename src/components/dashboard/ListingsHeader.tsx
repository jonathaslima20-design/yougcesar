import { Link } from 'react-router-dom';
import {
  Plus,
  ArrowUpDown,
  LayoutGrid,
  List,
  Download,
  Upload,
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'recent' | 'oldest' | 'price_high' | 'price_low' | 'most_viewed' | 'low_stock' | 'alpha' | 'display_order';

interface ListingsHeaderProps {
  canReorder: boolean;
  isReorderModeActive: boolean;
  reordering: boolean;
  totalProducts: number;
  viewMode: ViewMode;
  onToggleReorderMode: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onExport: () => void;
  onImport: () => void;
  onManageTags: () => void;
}

export function ListingsHeader({
  canReorder,
  isReorderModeActive,
  reordering,
  totalProducts,
  viewMode,
  onToggleReorderMode,
  onViewModeChange,
  onExport,
  onImport,
  onManageTags,
}: ListingsHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Top row: Title + Main actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Meus Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalProducts} {totalProducts === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/dashboard/products/new">
            <Button size="sm" className="shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Produto
            </Button>
          </Link>
        </div>
      </div>

      {/* Toolbar row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View mode toggle */}
        <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border/50">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Reorder toggle */}
        {canReorder && (
          <Button
            variant={isReorderModeActive ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleReorderMode}
            disabled={reordering}
            className={`text-xs h-8 ${isReorderModeActive ? 'shadow-md' : ''}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">{isReorderModeActive ? 'Sair da Reordenação' : 'Reordenar'}</span>
            <span className="sm:hidden">{isReorderModeActive ? 'Sair' : 'Reordenar'}</span>
          </Button>
        )}

        {/* Tags */}
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={onManageTags}>
          <Tags className="w-3.5 h-3.5 mr-1.5" />
          <span className="hidden sm:inline">Tags</span>
        </Button>

        {/* Export/Import */}
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={onExport}>
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={onImport}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          <span className="hidden sm:inline">Importar</span>
        </Button>
      </div>
    </div>
  );
}
