import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';
import type { Product, PriceTier } from '@/types';
import type { SupportedCurrency, SupportedLanguage } from '@/lib/i18n';

interface OffersCarouselProps {
  products: Product[];
  corretorSlug: string;
  currency?: SupportedCurrency;
  language?: SupportedLanguage;
  inventoryEnabled?: boolean;
  showStockOnStorefront?: boolean;
  blockZeroStock?: boolean;
  cartEnabled?: boolean;
  priceTiersMap?: Map<string, PriceTier[]>;
}

const MAX_OFFERS = 12;

export default function OffersCarousel({
  products,
  corretorSlug,
  currency = 'BRL',
  language = 'pt-BR',
  inventoryEnabled = false,
  showStockOnStorefront = false,
  blockZeroStock = false,
  cartEnabled = true,
  priceTiersMap,
}: OffersCarouselProps) {
  const offers = useMemo(
    () =>
      products
        .filter(
          (p) =>
            p.status === 'disponivel' &&
            typeof p.price === 'number' &&
            typeof p.discounted_price === 'number' &&
            p.discounted_price > 0 &&
            p.discounted_price < p.price
        )
        .slice(0, MAX_OFFERS),
    [products]
  );

  if (offers.length === 0) return null;

  return (
    <div className="container mx-auto px-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-primary" />
        <h2 className="text-base md:text-lg font-semibold">Ofertas</h2>
      </div>
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-thin">
        {offers.map((product) => (
          <div key={product.id} className="w-36 sm:w-44 md:w-48 shrink-0 snap-start">
            <ProductCard
              product={product}
              corretorSlug={corretorSlug}
              currency={currency}
              language={language}
              inventoryEnabled={inventoryEnabled}
              showStockOnStorefront={showStockOnStorefront}
              blockZeroStock={blockZeroStock}
              cartEnabled={cartEnabled}
              priceTiers={priceTiersMap?.get(product.id) ?? null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
