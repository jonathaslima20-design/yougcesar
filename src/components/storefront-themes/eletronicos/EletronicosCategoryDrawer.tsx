import { ChevronRight, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface EletronicosCategoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onOpenFilters: () => void;
}

/**
 * The real category menu for the Eletrônicos theme. The header's ☰ (mobile) and
 * "Todas Categorias" (desktop) open this list — not the filter panel, which used to
 * be the only thing behind those buttons and made picking a category a dropdown
 * inside a filter form. The full filters stay one tap away at the bottom.
 */
export default function EletronicosCategoryDrawer({
  open,
  onOpenChange,
  categories,
  activeCategory,
  onSelectCategory,
  onOpenFilters,
}: EletronicosCategoryDrawerProps) {
  const choose = (category: string | null) => {
    onSelectCategory(category);
    onOpenChange(false);
  };

  const rowClass = (active: boolean) =>
    cn(
      'w-full flex items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-sm transition-colors',
      active ? 'bg-muted font-semibold' : 'hover:bg-muted/60'
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] sm:max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 pt-5 pb-3 border-b">
          <SheetTitle>Categorias</SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="Categorias">
          <button type="button" onClick={() => choose(null)} className={rowClass(!activeCategory)}>
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Todos os produtos
            </span>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => choose(category)}
              className={rowClass(activeCategory === category)}
            >
              <span className="truncate">{category}</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
            </button>
          ))}
        </nav>

        <div className="border-t p-3">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onOpenFilters();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium hover:bg-muted/60"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros avançados
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
