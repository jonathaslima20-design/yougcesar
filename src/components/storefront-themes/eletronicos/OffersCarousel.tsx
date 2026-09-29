import { ProductCard } from '@/components/product/ProductCard';
import { useStorefrontOfferProducts } from '@/hooks/useStorefrontOfferProducts';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type OffersCarouselProps = Pick<
  StorefrontPageBodyProps,
  'corretor' | 'currency' | 'language' | 'inventoryEnabled' | 'showStockOnStorefront' | 'blockZeroStock' | 'cartEnabled'
>;

/**
 * "Ofertas" row — a horizontal carousel of products the merchant hand-picks
 * (products.storefront_offer). Only shown when at least one product is selected.
 */
export default function OffersCarousel({
  corretor,
  currency,
  language,
  inventoryEnabled,
  showStockOnStorefront,
  blockZeroStock,
  cartEnabled,
}: OffersCarouselProps) {
  const { products, loading } = useStorefrontOfferProducts(corretor.id);

  if (loading || products.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold inline-block relative pb-2">
            Ofertas
            <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-16 bg-current" />
          </h2>
        </div>

        <Carousel opts={{ align: 'start' }} className="relative">
          <CarouselContent>
            {products.map((product) => (
              <CarouselItem key={product.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4 pl-4">
                <div className="h-full">
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
