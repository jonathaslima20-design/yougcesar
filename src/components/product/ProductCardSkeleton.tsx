import { Skeleton } from '@/components/ui/skeleton';

export function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow overflow-hidden h-full flex flex-col animate-pulse">
      <div className="relative aspect-square overflow-hidden p-2 md:p-3">
        <div className="w-full h-full bg-white rounded-lg overflow-hidden border border-gray-200">
          <Skeleton className="w-full h-full" />
        </div>
      </div>

      <div className="p-2 md:p-4 flex-1 flex flex-col">
        <Skeleton className="h-4 w-3/4 mb-3" />
        <Skeleton className="h-4 w-1/2 mb-4" />

        <div className="mt-auto">
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-3 w-2/3 mb-4" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}
