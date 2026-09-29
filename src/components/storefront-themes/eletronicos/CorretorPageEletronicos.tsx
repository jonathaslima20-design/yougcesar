import CorretorHeaderEletronicos from '@/components/storefront-themes/eletronicos/CorretorHeaderEletronicos';
import BannerCarousel from '@/components/storefront-themes/eletronicos/BannerCarousel';
import BenefitsBar from '@/components/storefront-themes/eletronicos/BenefitsBar';
import CategoryShowcase from '@/components/storefront-themes/eletronicos/CategoryShowcase';
import MiniBannerGrid from '@/components/storefront-themes/eletronicos/MiniBannerGrid';
import NewArrivalsCarousel from '@/components/storefront-themes/eletronicos/NewArrivalsCarousel';
import EletronicosBreadcrumb from '@/components/storefront-themes/eletronicos/EletronicosBreadcrumb';
import CorretorFooterEletronicos from '@/components/storefront-themes/eletronicos/CorretorFooterEletronicos';
import StorefrontProductCatalogSectionEletronicos from '@/components/storefront-themes/eletronicos/StorefrontProductCatalogSectionEletronicos';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

export default function CorretorPageEletronicos(props: StorefrontPageBodyProps) {
  const { filters, onFiltersChange, settings } = props;
  const activeCategory = filters?.category && filters.category !== 'todos' ? filters.category : null;

  // Deliberately NOT `isSearchActive` — that flag also compares filters.minPrice/
  // maxPrice against settings.priceRange, which almost never matches the hook's
  // hardcoded {0, 5000} starting values. That mismatch alone makes it permanently
  // true after the very first filter interaction, even once everything else is
  // back to "todos" — which would leave this page stuck hiding its home sections
  // for the rest of the visit. This mirrors the same "any real filter active"
  // check, minus that price comparison.
  const isBrowsing = !!(
    filters?.query ||
    activeCategory ||
    (filters?.status && filters.status !== 'todos') ||
    (filters?.brand && filters.brand !== 'todos') ||
    (filters?.gender && filters.gender !== 'todos') ||
    (filters?.sizes && filters.sizes !== 'todos') ||
    (filters?.condition && filters.condition !== 'todos')
  );

  const resetFilters = () => {
    onFiltersChange({
      ...filters,
      category: 'todos',
      query: '',
      status: 'todos',
      brand: 'todos',
      gender: 'todos',
      sizes: 'todos',
      condition: 'todos',
      minPrice: settings?.priceRange?.minPrice ?? 0,
      maxPrice: settings?.priceRange?.maxPrice ?? 5000,
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <CorretorHeaderEletronicos {...props} />

      {/* Home-only marketing blocks — hidden as soon as any filter narrows the
          catalog (category, search, brand, price...), matching a dedicated
          category page on the reference theme instead of a cluttered browse view. */}
      {!isBrowsing && (
        <>
          <BannerCarousel userId={props.corretor.id} />
          <BenefitsBar userId={props.corretor.id} />
          <CategoryShowcase {...props} />
        </>
      )}

      {isBrowsing && (
        <EletronicosBreadcrumb
          category={activeCategory}
          searchQuery={filters?.query || null}
          onReset={resetFilters}
        />
      )}

      <div className="flex-1">
        <StorefrontProductCatalogSectionEletronicos {...props} />
      </div>

      {!isBrowsing && (
        <>
          <MiniBannerGrid userId={props.corretor.id} />
          <NewArrivalsCarousel {...props} />
        </>
      )}

      <CorretorFooterEletronicos {...props} />
    </div>
  );
}
