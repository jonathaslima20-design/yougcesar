import { Fragment, useState } from 'react';
import EletronicosFiltersPanel from '@/components/storefront-themes/eletronicos/EletronicosFiltersPanel';
import EletronicosProductToolbar from '@/components/storefront-themes/eletronicos/EletronicosProductToolbar';
import type { EletronicosSortKey } from '@/components/storefront-themes/eletronicos/eletronicosSort';
import CorretorHeaderEletronicos from '@/components/storefront-themes/eletronicos/CorretorHeaderEletronicos';
import BannerCarousel from '@/components/storefront-themes/eletronicos/BannerCarousel';
import BenefitsBar from '@/components/storefront-themes/eletronicos/BenefitsBar';
import CategoryShowcase from '@/components/storefront-themes/eletronicos/CategoryShowcase';
import MiniBannerGrid from '@/components/storefront-themes/eletronicos/MiniBannerGrid';
import OffersCarousel from '@/components/storefront-themes/eletronicos/OffersCarousel';
import FeatureBanner from '@/components/storefront-themes/eletronicos/FeatureBanner';
import NewArrivalsCarousel from '@/components/storefront-themes/eletronicos/NewArrivalsCarousel';
import EletronicosBreadcrumb from '@/components/storefront-themes/eletronicos/EletronicosBreadcrumb';
import CorretorFooterEletronicos from '@/components/storefront-themes/eletronicos/CorretorFooterEletronicos';
import StorefrontProductCatalogSectionEletronicos from '@/components/storefront-themes/eletronicos/StorefrontProductCatalogSectionEletronicos';
import EletronicosFiltersSidebar from '@/components/storefront-themes/eletronicos/EletronicosFiltersSidebar';
import { useEletronicosCatalogSummary } from '@/components/storefront-themes/eletronicos/eletronicosCatalog';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { resolveHomeSectionOrder, type HomeSectionId } from '@/lib/appearanceDefaults';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

export default function CorretorPageEletronicos(props: StorefrontPageBodyProps) {
  const { filters, onFiltersChange, settings } = props;
  const { appearance } = useStorefrontTheme();
  // The filter panel and the sort order live here (not in the header) so both the
  // header/category menu and the toolbar above the grid can open the same panel.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<EletronicosSortKey>('relevance');
  // Light per-product summary (cover images, price range, filter counts, search
  // suggestions). The full catalog is no longer downloaded for this theme's home.
  const summary = useEletronicosCatalogSummary(props.corretor.id);

  // The movable home sections; order comes from the merchant's saved layout
  // (Personalizar Eletrônicos → Ordem das seções), defaulting to the original one.
  const homeSections: Record<HomeSectionId, JSX.Element> = {
    banners: <BannerCarousel userId={props.corretor.id} />,
    benefits: <BenefitsBar userId={props.corretor.id} />,
    categories: <CategoryShowcase {...props} covers={summary.covers} />,
    offers: <OffersCarousel {...props} />,
    feature_banner: <FeatureBanner />,
    mini_banners: <MiniBannerGrid userId={props.corretor.id} />,
    new_arrivals: <NewArrivalsCarousel {...props} />,
  };
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
      <CorretorHeaderEletronicos {...props} onOpenFilters={() => setFiltersOpen(true)} catalogRows={summary.rows} />

      <EletronicosFiltersPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        priceRange={summary.priceRange}
        rows={summary.rows}
        filterMetadata={props.filterMetadata}
        currency={props.currency}
        language={props.language}
        settings={props.settings}
        sizeTypeMapping={props.sizeTypeMapping}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />

      {/* Home-only marketing blocks — hidden as soon as any filter narrows the
          catalog (category, search, brand, price...), matching a dedicated
          category page on the reference theme instead of a cluttered browse view. */}
      {!isBrowsing &&
        resolveHomeSectionOrder(appearance.home_section_order).map((id) => (
          <Fragment key={id}>{homeSections[id]}</Fragment>
        ))}

      {isBrowsing && (
        <EletronicosBreadcrumb
          category={activeCategory}
          searchQuery={filters?.query || null}
          onReset={resetFilters}
        />
      )}

      {isBrowsing && (
        <EletronicosProductToolbar
          filters={filters}
          onFiltersChange={onFiltersChange}
          onOpenFilters={() => setFiltersOpen(true)}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      {/* The product grid only appears once a category/search/filter is active —
          the home itself stays light, driven by the Ofertas/Novidades carousels. */}
      {isBrowsing ? (
        <div className="flex-1 container mx-auto px-4 flex gap-8 items-start">
          <EletronicosFiltersSidebar
            filters={filters}
            onFiltersChange={onFiltersChange}
            currency={props.currency}
            language={props.language}
            settings={props.settings}
            filterMetadata={props.filterMetadata}
            rows={summary.rows}
            priceRange={summary.priceRange}
          />
          <div className="flex-1 min-w-0">
            <StorefrontProductCatalogSectionEletronicos {...props} sortBy={sortBy} withSidebar />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <CorretorFooterEletronicos {...props} />
    </div>
  );
}
