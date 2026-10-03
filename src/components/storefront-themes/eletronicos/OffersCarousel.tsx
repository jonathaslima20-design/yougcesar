import { ProductCard } from '@/components/product/ProductCard';
import { useStorefrontOfferProducts } from '@/hooks/useStorefrontOfferProducts';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ProductCardPlaceholder } from '@/components/storefront-themes/eletronicos/ProductCardPlaceholder';
import { CarouselSkeleton } from '@/components/storefront-themes/eletronicos/CarouselSkeleton';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

const PLACEHOLDER_SLOTS = 4;

type OffersCarouselProps = Pick<
  StorefrontPageBodyProps,
  'corretor' | 'currency' | 'language' | 'inventoryEnabled' | 'showStockOnStorefront' | 'blockZeroStock' | 'cartEnabled' | 'onlineSalesEnabled' | 'onProductNavigate'
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
  onlineSalesEnabled,
  onProductNavigate,
}: OffersCarouselProps) {
  const { appearance } = useStorefrontTheme();
  const { products, loading } = useStorefrontOfferProducts(corretor.id);

  const heading = (
    <div className="text-center mb-6">
      <h2 className="text-xl md:text-2xl font-bold inline-block relative pb-2">
        {appearance.offers_title || 'Ofertas'}
        <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-16 bg-current" />
      </h2>
    </div>
  );

  if (loading) return <CarouselSkeleton heading={heading} />;

  // No product picked for this row yet — a static grid of placeholder cards
  // instead of hiding the section, same reasoning as the banner placeholders.
  if (products.length === 0) {
    return (
      <section className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          {heading}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: PLACEHOLDER_SLOTS }).map((_, i) => (
              <ProductCardPlaceholder key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-10">
      <div className="container mx-auto px-4">
        {heading}

        <Carousel opts={{ align: 'start' }} className="relative">
          <CarouselContent className="-ml-4">
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
                    buyNowEnabled={onlineSalesEnabled}
                    onNavigate={onProductNavigate}
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
