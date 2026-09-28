import { useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type CategoryShowcaseProps = Pick<StorefrontPageBodyProps, 'allProducts' | 'filterMetadata' | 'filters' | 'onFiltersChange'>;

/**
 * "Navegue por Categorias" row from the reference theme. Each circle uses the featured
 * image of the first product found in that category — no new image upload/field needed,
 * every store already has this data the moment it has products.
 */
export default function CategoryShowcase({ allProducts, filterMetadata, filters, onFiltersChange }: CategoryShowcaseProps) {
  const categories: string[] = filterMetadata?.categories || [];
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (categories.length === 0) return null;

  const categoryImage = (category: string) => {
    const match = allProducts.find((p) => p.category?.includes(category) && p.featured_image_url);
    return match?.featured_image_url;
  };

  const selectCategory = (category: string) => {
    onFiltersChange({ ...filters, category });
  };

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold inline-block relative pb-2">
            Navegue por Categorias
            <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-0.5 w-16 bg-foreground" />
          </h2>
        </div>

        <div className="relative">
          <div ref={scrollerRef} className="flex items-start gap-6 overflow-x-auto scroll-smooth pb-2">
            {categories.map((category) => {
              const image = categoryImage(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => selectCategory(category)}
                  className="shrink-0 flex flex-col items-center gap-2 w-24"
                >
                  <span className="h-20 w-20 rounded-full overflow-hidden bg-muted border flex items-center justify-center">
                    {image ? (
                      <img src={image} alt={category} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{category.slice(0, 2)}</span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-center leading-tight">{category}</span>
                </button>
              );
            })}
          </div>

          {categories.length > 5 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:flex absolute -left-4 top-8 h-8 w-8 rounded-full bg-background"
                onClick={() => scrollBy(-240)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:flex absolute -right-4 top-8 h-8 w-8 rounded-full bg-background"
                onClick={() => scrollBy(240)}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
