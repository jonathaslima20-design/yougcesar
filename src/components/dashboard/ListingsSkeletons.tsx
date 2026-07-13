import { Skeleton } from '@/components/ui/skeleton';

export function ListingsHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
      <Skeleton className="h-9 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function ListingsFiltersSkeleton() {
  return (
    <div className="mb-6 space-y-4">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-xs" />
      </div>
    </div>
  );
}

export function ListingsStatusBarSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-muted rounded-lg mb-6">
      <div className="flex gap-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border p-4 space-y-4 h-full">
      <Skeleton className="h-48 w-full rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-6 w-1/4" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
