import { useEffect, useState } from 'react';
import type { CarouselApi } from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

/**
 * Dots under a product carousel: one per page of products, the current page highlighted.
 * Tapping a dot jumps to that page. Takes the colour of its section (text colour), so it
 * follows the merchant's section colours.
 */
export function CarouselDots({ api }: { api: CarouselApi | undefined }) {
  const [pageCount, setPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(0);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setPageCount(api.scrollSnapList().length);
      setSelectedPage(api.selectedScrollSnap());
    };
    update();
    api.on('select', update);
    api.on('reInit', update);
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
  }, [api]);

  // One page is the whole row: no dots needed.
  if (pageCount <= 1) return null;

  return (
    <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Páginas do carrossel">
      {Array.from({ length: pageCount }).map((_, index) => {
        const active = index === selectedPage;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`Ir para a página ${index + 1}`}
            onClick={() => api?.scrollTo(index)}
            className={cn(
              'h-2 rounded-full bg-current transition-all duration-300',
              active ? 'w-6 opacity-100' : 'w-2 opacity-30 hover:opacity-60'
            )}
          />
        );
      })}
    </div>
  );
}
