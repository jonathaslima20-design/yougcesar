import type { ReactNode } from 'react';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton';

const SKELETON_SLOTS = 4;

/**
 * Loading state for the product carousels (Ofertas, Novidades, Destaques). Keeps the
 * section's heading and the same grid as the loaded row, so the page doesn't jump when
 * the products arrive. Returning nothing here made the whole block pop in late.
 */
export function CarouselSkeleton({ heading }: { heading: ReactNode }) {
  return (
    <section className="py-8 md:py-10">
      <div className="container mx-auto px-4">
        {heading}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {Array.from({ length: SKELETON_SLOTS }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
