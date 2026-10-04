import { useState } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { CarouselSkeleton } from '@/components/storefront-themes/eletronicos/CarouselSkeleton';
import { useStorefrontHighlightProducts } from '@/hooks/useStorefrontHighlightProducts';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { CarouselDots } from '@/components/storefront-themes/eletronicos/CarouselDots';
import { ProductCardPlaceholder } from '@/components/storefront-themes/eletronicos/ProductCardPlaceholder';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

const PLACEHOLDER_SLOTS = 4;

type HighlightsCarouselProps = Pick<
  StorefrontPageBodyProps,
  'corretor' | 'currency' | 'language' | 'inventoryEnabled' | 'showStockOnStorefront' | 'blockZeroStock' | 'cartEnabled' | 'onlineSalesEnabled' | 'onProductNavigate'
>;

/**
 * "Destaques" row — a horizontal carousel of products the merchant hand-picks
 * (products.storefront_highlight), each with a "Destaque" badge. Same model as
 * "Novidades", shown right below the Mini banners. Only shown when at least one
 * product is marked.
 */
export default function HighlightsCarousel({
  corretor,
  currency,
  language,
  inventoryEnabled,
  showStockOnStorefront,
  blockZeroStock,
  cartEnabled,
  onlineSalesEnabled,
  onProductNavigate,
}: HighlightsCarouselProps) {
  const { appearance } = useStorefrontTheme();
  const { products, loading } = useStorefrontHighlightProducts(corretor.id);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  const heading = (
    <div className="text-center mb-6">
      <h2 className="text-xl md:text-2xl font-bold inline-block relative pb-2">
        {appearance.highlights_title || 'Destaques'}
        <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-16" style={{ backgroundColor: appearance.highlights_text_color }} />
      </h2>
    </div>
  );

  if (loading) return <CarouselSkeleton heading={heading} />;

  // No product picked for this row yet — a static grid of placeholder cards
  // instead of hiding the section, same reasoning as the banner placeholders.
  if (products.length === 0) {
    return (
      <section
        className="py-8 md:py-10"
        style={{ backgroundColor: appearance.highlights_bg_color, color: appearance.highlights_text_color }}
      >
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
    <section
      className="py-8 md:py-10"
      style={{ backgroundColor: appearance.highlights_bg_color, color: appearance.highlights_text_color }}
    >
      <div className="container mx-auto px-4">
        {heading}

        <Carousel opts={{ align: 'start', slidesToScroll: 'auto' }} setApi={setCarouselApi} className="relative">
          <CarouselContent className="-ml-4">
            {products.map((product) => (
              <CarouselItem key={product.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4 pl-4">
                <div className="relative h-full">
                  <span className="absolute top-3 left-3 md:top-5 md:left-5 z-10 inline-flex items-center rounded-full bg-neutral-900 text-white text-[10px] md:text-xs font-semibold uppercase tracking-wide px-1.5 md:px-2 py-0.5 md:py-1 shadow-sm">
                    Destaque
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
                    buyNowEnabled={onlineSalesEnabled}
                    onNavigate={onProductNavigate}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {products.length > 4 && (
            <>
            </>
          )}
        </Carousel>
        <CarouselDots api={carouselApi} />
      </div>
    </section>
  );
}
