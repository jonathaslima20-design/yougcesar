import { Loader } from 'lucide-react';
import { useLazyLoad } from '@/hooks/useLazyLoad';

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  hasNextPage: boolean;
  isLoading: boolean;
}

export default function InfiniteScrollTrigger({
  onLoadMore,
  hasNextPage,
  isLoading,
}: InfiniteScrollTriggerProps) {
  const { ref } = useLazyLoad({
    onIntersect: onLoadMore,
    enabled: hasNextPage && !isLoading,
    threshold: 0.1,
    rootMargin: '200px',
  });

  if (!hasNextPage) {
    return null;
  }

  return (
    <div ref={ref} className="flex justify-center py-8">
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
}
