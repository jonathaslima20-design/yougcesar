import { Loader2, ChevronDown } from 'lucide-react';
import { useLazyLoad } from '@/hooks/useLazyLoad';
import { Button } from '@/components/ui/button';

interface DashboardInfiniteScrollTriggerProps {
  onLoadMore: () => void;
  onLoadAll?: () => void;
  hasNextPage: boolean;
  isLoading: boolean;
  displayedCategoriesCount: number;
  totalCategoriesCount: number;
}

export default function DashboardInfiniteScrollTrigger({
  onLoadMore,
  onLoadAll,
  hasNextPage,
  isLoading,
  displayedCategoriesCount,
  totalCategoriesCount,
}: DashboardInfiniteScrollTriggerProps) {
  const { ref } = useLazyLoad({
    onIntersect: onLoadMore,
    enabled: hasNextPage && !isLoading,
    threshold: 0.1,
    rootMargin: '300px',
  });

  if (!hasNextPage && displayedCategoriesCount === totalCategoriesCount) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-center text-sm text-muted-foreground">
          <p>Todas as {totalCategoriesCount} categorias foram carregadas</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col items-center justify-center gap-4 py-8">
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            Carregando... ({displayedCategoriesCount}/{totalCategoriesCount})
          </span>
        </div>
      ) : hasNextPage ? (
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Exibindo {displayedCategoriesCount} de {totalCategoriesCount} categorias
          </div>
          <div className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground animate-bounce" />
            <span className="text-xs text-muted-foreground">Role para carregar mais</span>
          </div>
          {onLoadAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadAll}
              className="mt-2"
            >
              Carregar todas as categorias
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
