import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { useStorefrontCategoryImages } from '@/hooks/useStorefrontCategoryImages';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type CategoryShowcaseProps = Pick<StorefrontPageBodyProps, 'corretor' | 'allProducts' | 'filterMetadata' | 'filters' | 'onFiltersChange'>;

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
export default function CategoryShowcase({ corretor, allProducts, filterMetadata, filters, onFiltersChange }: CategoryShowcaseProps) {
  const { appearance } = useStorefrontTheme();
  const { getImage } = useStorefrontCategoryImages(corretor.id);
  const categories: string[] = filterMetadata?.categories || [];

  if (!appearance.category_showcase_enabled || categories.length === 0) return null;

  const categoryImage = (category: string) => {
    const override = getImage(category);
    if (override) return override;
    const match = allProducts.find((p) => p.category?.includes(category) && p.featured_image_url);
    return match?.featured_image_url;
  };

  const selectCategory = (category: string) => {
    onFiltersChange({ ...filters, category });
  };

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold inline-block relative pb-2">
            {appearance.category_showcase_title || 'Navegue por Categorias'}
            <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-16 bg-foreground" />
          </h2>
        </div>

        <Carousel opts={{ align: 'start', dragFree: true }} className="relative">
          <CarouselContent className="-ml-6 py-1">
            {categories.map((category) => {
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
                        <img src={image} alt={category} className="h-full w-full object-cover" draggable={false} />
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
