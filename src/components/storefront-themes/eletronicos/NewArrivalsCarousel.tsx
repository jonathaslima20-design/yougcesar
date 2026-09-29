import { ProductCard } from '@/components/product/ProductCard';
import { useStorefrontFeaturedProducts } from '@/hooks/useStorefrontFeaturedProducts';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type NewArrivalsCarouselProps = Pick<
  StorefrontPageBodyProps,
  'corretor' | 'currency' | 'language' | 'inventoryEnabled' | 'showStockOnStorefront' | 'blockZeroStock' | 'cartEnabled'
>;

/**
 * "Novidades" row from the reference theme — a horizontal carousel of products the
 * merchant hand-picks (products.storefront_featured), each with a "Novo" badge.
 * Only shown when at least one product is marked as featured.
 */
export default function NewArrivalsCarousel({
  corretor,
  currency,
  language,
  inventoryEnabled,
  showStockOnStorefront,
  blockZeroStock,
  cartEnabled,
}: NewArrivalsCarouselProps) {
  const { appearance } = useStorefrontTheme();
  const { products, loading } = useStorefrontFeaturedProducts(corretor.id);

  if (loading || products.length === 0) return null;

  return (
    <section
      className="py-10"
      style={{ backgroundColor: appearance.new_arrivals_bg_color, color: appearance.new_arrivals_text_color }}
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold inline-block relative pb-2">
            Novidades
            <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-16" style={{ backgroundColor: appearance.new_arrivals_text_color }} />
          </h2>
        </div>

        <Carousel opts={{ align: 'start' }} className="relative">
          <CarouselContent>
            {products.map((product) => (
              <CarouselItem key={product.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4 pl-4">
                <div className="relative h-full">
                  <span className="absolute top-3 left-3 md:top-5 md:left-5 z-10 inline-flex items-center rounded-full bg-neutral-900 text-white text-[10px] md:text-xs font-semibold uppercase tracking-wide px-1.5 md:px-2 py-0.5 md:py-1 shadow-sm">
                    Novo
                  </span>
                  <ProductCard
                    product={product}
                    corretorSlug={corretor.slug || ''}
                    currency={currency}
                    language={language}
                    inventoryEnabled={inventoryEnabled}
                    showStockOnStorefront={showStockOnStorefront}
                    blockZeroStock={blockZeroStock}
                    cartEnabled={cartEnabled}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {products.length > 4 && (
            <>
              <CarouselPrevious className="-left-4" />
              <CarouselNext className="-right-4" />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}
