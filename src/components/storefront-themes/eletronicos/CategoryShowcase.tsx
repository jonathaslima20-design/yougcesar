import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { useStorefrontCategoryImages } from '@/hooks/useStorefrontCategoryImages';
import { getImageSrcSet, getResizedImageUrl } from '@/lib/imageUrl';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type CategoryShowcaseProps = Pick<StorefrontPageBodyProps, 'corretor' | 'filterMetadata' | 'filters' | 'onFiltersChange'> & {
  /** category -> cover image (first product's photo), from the lightweight catalog summary. */
  covers: Record<string, string>;
};

/**
 * "Navegue por Categorias" row from the reference theme. Each circle uses the featured
 * image of the first product found in that category by default — a merchant can
 * override any single category's image in "Personalizar Eletrônicos" without
 * needing a new upload for every category up front.
 *
 * Free-dragging carousel (Embla, dragFree) rather than a plain scroll container:
 * lets a visitor flick/drag through categories and release anywhere, while a plain
 * tap (no drag) still selects the category — Embla tells the two apart natively.
 */
export default function CategoryShowcase({ corretor, covers, filterMetadata, filters, onFiltersChange }: CategoryShowcaseProps) {
  const { appearance } = useStorefrontTheme();
  const { getImage } = useStorefrontCategoryImages(corretor.id);
  const categories: string[] = filterMetadata?.categories || [];

  if (!appearance.category_showcase_enabled || categories.length === 0) return null;

  const categoryImage = (category: string) => {
    const override = getImage(category);
    if (override) return override;
    return covers[category];
  };

  const selectCategory = (category: string) => {
    onFiltersChange({ ...filters, category });
  };

  return (
    <section
      className="py-10"
      style={{ backgroundColor: appearance.category_showcase_bg_color, color: appearance.category_showcase_text_color }}
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold inline-block relative pb-2">
            {appearance.category_showcase_title || 'Navegue por Categorias'}
            <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-16" style={{ backgroundColor: appearance.category_showcase_text_color }} />
          </h2>
        </div>

        <Carousel opts={{ align: 'start', dragFree: true }} className="relative">
          <CarouselContent className="-ml-6 py-1">
            {categories.map((category, index) => {
              const image = categoryImage(category);
              return (
                <CarouselItem key={category} className="basis-auto pl-6">
                  <button
                    type="button"
                    onClick={() => selectCategory(category)}
                    className="shrink-0 flex flex-col items-center gap-2 w-24"
                  >
                    <span className="h-20 w-20 rounded-full overflow-hidden bg-muted border flex items-center justify-center pointer-events-none">
                      {image ? (
                        <img
                          src={getResizedImageUrl(image, 160)}
                          srcSet={getImageSrcSet(image, [80, 160, 240])}
                          sizes="80px"
                          alt={category}
                          width={80}
                          height={80}
                          // The first few circles are on screen right away; the rest sit off to
                          // the side of the carousel, so they shouldn't compete with the banner.
                          loading={index < 4 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{category.slice(0, 2)}</span>
                      )}
                    </span>
                    <span className="text-xs font-medium text-center leading-tight pointer-events-none">{category}</span>
                  </button>
                </CarouselItem>
              );
            })}
          </CarouselContent>

          {categories.length > 5 && (
            <>
              <CarouselPrevious className="hidden sm:flex -left-4" />
              <CarouselNext className="hidden sm:flex -right-4" />
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}
