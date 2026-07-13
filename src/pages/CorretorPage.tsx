import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader, CircleAlert as AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCorretorData } from '@/hooks/useCorretorData';
import { useProductData } from '@/hooks/useProductData';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useCorretorPageState } from '@/hooks/useCorretorPageState';
import { useProductFilterMetadata } from '@/hooks/useProductFilterMetadata';
import { useServerSideProductSearch } from '@/hooks/useServerSideProductSearch';
import { useCategoryPagination } from '@/hooks/useCategoryPagination';
import CorretorHeader from '@/components/corretor/CorretorHeader';
import ProductSearch from '@/components/product/ProductSearch';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton';
import { groupProductsByCategory } from '@/utils/productDisplayUtils';
import ShareCategoryButton from '@/components/corretor/ShareCategoryButton';
import PaginationControls from '@/components/corretor/PaginationControls';
import InfiniteScrollTrigger from '@/components/corretor/InfiniteScrollTrigger';
import { logCategoryOperation } from '@/lib/categoryUtils';
import { useTranslation, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { updateMetaTags, getCorretorMetaTags } from '@/utils/metaTags';
import { scrollCoordinator } from '@/lib/scrollCoordinator';
import { StorefrontThemeProvider } from '@/contexts/StorefrontThemeContext';
import { useInventoryEnabledForStore } from '@/hooks/useInventoryEnabled';
import { useCheckoutSettingsForStore } from '@/hooks/useCheckoutSettings';
import { generateReferralLink } from '@/lib/referralUtils';

const PromotionalBanner = lazy(() => import('@/components/corretor/PromotionalBanner'));

interface CorretorPageProps {
  customDomainSlug?: string;
}

export default function CorretorPage({ customDomainSlug }: CorretorPageProps = {}) {
  const { slug: paramSlug } = useParams();
  const slug = customDomainSlug || paramSlug;
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchResultsPage, setSearchResultsPage] = useState(1);

  // Search results state
  const [serverSearchResults, setServerSearchResults] = useState<any[]>([]);
  const [allServerSearchResults, setAllServerSearchResults] = useState<any[]>([]);

  // Restoration flow state
  // Phase 1: detect return from product page
  // Phase 2: state has been read and applied (pagination/filters)
  // Phase 3: content is rendered, execute scroll
  const [restorationPhase, setRestorationPhase] = useState<'idle' | 'detecting' | 'restoring' | 'awaiting-content' | 'scrolling' | 'done'>('idle');
  const savedScrollPositionRef = useRef<number>(0);
  const restoredSearchPageRef = useRef<number | null>(null);
  const scrollRestorationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // User-initiated vs system-initiated search guard
  const userInitiatedSearchRef = useRef(false);
  const previousFiltersRef = useRef<any>(null);
  const productsContainerRef = useRef<HTMLDivElement>(null);
  const latestFiltersRef = useRef<any>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageSize = 100;

  // Load corretor data
  const { corretor, loading: corretorLoading, error: corretorError, preloadedAppearance } = useCorretorData({ slug });

  const isPaidPlan = corretor?.plan_status === 'active';
  const { inventoryEnabled, showStockOnStorefront } = useInventoryEnabledForStore(corretor?.id);
  const { settings: checkoutSettings } = useCheckoutSettingsForStore(corretor?.id);
  const cartEnabled = checkoutSettings.cartEnabled ?? true;

  const language: SupportedLanguage = corretor?.language || 'pt-BR';
  const currency: SupportedCurrency = corretor?.currency || 'BRL';
  const { t } = useTranslation(language);

  const {
    allProducts,
    categorySettings,
    settings,
    loading: productsLoading,
    error: productsError,
    sizeTypeMapping,
    totalProducts,
  } = useProductData({
    userId: corretor?.id || '',
    language,
  });

  const {
    displayedCategories,
    currentCategoryIndex,
    totalCategories,
    hasNextCategory,
    loadNextCategory,
    resetToFirstCategory,
  } = useCategoryPagination({
    products: allProducts,
    categorySettings,
    language,
  });

  const { metadata: filterMetadata, loading: filterMetadataLoading } = useProductFilterMetadata({
    userId: corretor?.id || '',
    enabled: true
  });

  const { searchProducts, loading: serverSearchLoading } = useServerSideProductSearch();

  const {
    filteredProducts,
    isSearchActive,
    filters,
    handleSearch,
    searchQuery = '',
  } = useProductSearch({
    allProducts,
    settings
  });

  // Initialize page state hook - correctly passes searchResultsPage
  const pageStateHook = useCorretorPageState({
    slug: slug || '',
    currentPage,
    searchResultsPage,
    isSearchActive,
    filters,
    searchQuery,
  });

  // Initialize previousFiltersRef on first load
  useEffect(() => {
    if (previousFiltersRef.current === null) {
      previousFiltersRef.current = filters;
    }
  }, []);

  // ─── Server-side search ──────────────────────────────────────────────────────
  useEffect(() => {
    latestFiltersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (!isSearchActive || !corretor?.id) {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      setAllServerSearchResults([]);
      setServerSearchResults([]);
      setSearchResultsPage(1);
      resetToFirstCategory();
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const corretorId = corretor.id;
    const filtersSnapshot = { ...filters };

    searchDebounceRef.current = setTimeout(() => {
      const priceDefaults = {
        minPrice: settings?.priceRange?.minPrice ?? 0,
        maxPrice: settings?.priceRange?.maxPrice ?? 5000,
      };

      searchProducts(corretorId, filtersSnapshot, priceDefaults).then((results) => {
        setAllServerSearchResults(results);

        if (restoredSearchPageRef.current !== null) {
          setSearchResultsPage(restoredSearchPageRef.current);
          restoredSearchPageRef.current = null;
        } else {
          setSearchResultsPage(1);
        }
      });
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [isSearchActive, filters, corretor?.id, searchProducts, resetToFirstCategory, settings?.priceRange?.minPrice, settings?.priceRange?.maxPrice]);

  // Apply pagination to server search results
  useEffect(() => {
    if (allServerSearchResults.length > 0) {
      const offset = (searchResultsPage - 1) * pageSize;
      const paginated = allServerSearchResults.slice(offset, offset + pageSize);
      setServerSearchResults(paginated);
    }
  }, [allServerSearchResults, searchResultsPage, pageSize]);

  // ─── Scroll-to-top on user-initiated filter change ───────────────────────────
  useEffect(() => {
    if (userInitiatedSearchRef.current && restorationPhase === 'idle') {
      const filtersChanged = JSON.stringify(filters) !== JSON.stringify(previousFiltersRef.current);
      if (filtersChanged) {
        setTimeout(() => {
          requestAnimationFrame(() => {
            if (productsContainerRef.current) {
              productsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
        }, 100);
        previousFiltersRef.current = filters;
      }
    }
  }, [filters, restorationPhase]);

  // Reset to page 1 only on user-initiated search
  useEffect(() => {
    if (userInitiatedSearchRef.current && isSearchActive && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [isSearchActive, currentPage]);

  // ─── Meta tags ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (corretor) {
      const metaConfig = getCorretorMetaTags(corretor, language, !!customDomainSlug);
      updateMetaTags(metaConfig);
    }
  }, [corretor, language]);

  // ─── Footer referral link ──────────────────────────────────────────────────
  useEffect(() => {
    if (corretor?.referral_code) {
      const link = generateReferralLink(corretor.referral_code);
      document.documentElement.setAttribute('data-referral-link', link);
    }
    return () => {
      document.documentElement.removeAttribute('data-referral-link');
    };
  }, [corretor?.referral_code]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (scrollRestorationTimeoutRef.current) {
        clearTimeout(scrollRestorationTimeoutRef.current);
      }
    };
  }, []);

  // ─── RESTORATION FLOW ────────────────────────────────────────────────────────
  //
  // Phase 1 — DETECTING: triggered when location.state.from === 'product-detail'
  // Phase 2 — RESTORING: read saved state, apply filters/page
  // Phase 3 — AWAITING-CONTENT: wait for products + (if filtered) search results
  // Phase 4 — SCROLLING: scroll to saved position
  // Phase 5 — DONE

  // Phase 1: detect return from product page
  useEffect(() => {
    if (location.state?.from === 'product-detail' && restorationPhase === 'idle') {
      const savedState = pageStateHook.restoreCurrentState();
      if (savedState && savedState.slug === slug) {
        savedScrollPositionRef.current = savedState.scrollPosition;
        setRestorationPhase('restoring');
        scrollCoordinator.startScrollRestoration();
      }
    }
  }, [location.state?.from, slug]);

  // Phase 2: apply saved state (filters, page) — wait until data is loaded
  useEffect(() => {
    if (restorationPhase !== 'restoring') return;
    if (corretorLoading || productsLoading) return;

    const savedState = pageStateHook.restoreCurrentState();
    if (!savedState || savedState.slug !== slug) {
      setRestorationPhase('done');
      scrollCoordinator.endScrollRestoration();
      return;
    }

    if (savedState.isSearchActive && savedState.filters) {
      // Store which search-results page to apply once server search completes
      restoredSearchPageRef.current = savedState.currentPage >= 1 ? savedState.currentPage : 1;
      // Trigger the server search — results will come in via the search useEffect above
      handleSearch(savedState.filters);
      previousFiltersRef.current = savedState.filters;
      userInitiatedSearchRef.current = false;
      setRestorationPhase('awaiting-content');
    } else {
      if (savedState.currentPage > 1) {
        setCurrentPage(savedState.currentPage);
      }
      userInitiatedSearchRef.current = false;
      setRestorationPhase('awaiting-content');
    }
  }, [restorationPhase, corretorLoading, productsLoading, slug]);

  // Phase 3: wait for content to be rendered, then scroll
  // For filtered search: wait until server search results arrive AND pagination is applied
  // For normal view: wait until products are rendered
  useEffect(() => {
    if (restorationPhase !== 'awaiting-content') return;

    const savedState = pageStateHook.restoreCurrentState();
    if (!savedState || savedScrollPositionRef.current <= 0) {
      setRestorationPhase('done');
      scrollCoordinator.endScrollRestoration();
      return;
    }

    const isFiltered = savedState.isSearchActive && savedState.filters;

    // For filtered: wait for search to finish AND results to be sliced into serverSearchResults
    if (isFiltered) {
      if (serverSearchLoading || serverSearchResults.length === 0) return;
    } else {
      // For normal: wait until products have loaded
      if (productsLoading) return;
    }

    setRestorationPhase('scrolling');
  }, [restorationPhase, serverSearchLoading, serverSearchResults.length, productsLoading]);

  // Phase 4: perform the actual scroll with retries
  useEffect(() => {
    if (restorationPhase !== 'scrolling') return;

    const targetY = savedScrollPositionRef.current;
    if (targetY <= 0) {
      setRestorationPhase('done');
      scrollCoordinator.endScrollRestoration();
      return;
    }

    let attempts = 0;
    const maxAttempts = 8;
    const delays = [50, 100, 150, 250, 400, 600, 900, 1200];

    const tryScroll = () => {
      window.scrollTo(0, targetY);
      attempts++;

      if (attempts < maxAttempts) {
        scrollRestorationTimeoutRef.current = setTimeout(tryScroll, delays[attempts]);
      } else {
        setRestorationPhase('done');
        scrollCoordinator.endScrollRestoration();
      }
    };

    requestAnimationFrame(tryScroll);

    // Safety cleanup in case something goes wrong
    const safetyTimeout = setTimeout(() => {
      setRestorationPhase('done');
      scrollCoordinator.endScrollRestoration();
    }, 8000);

    return () => {
      clearTimeout(safetyTimeout);
      if (scrollRestorationTimeoutRef.current) {
        clearTimeout(scrollRestorationTimeoutRef.current);
      }
    };
  }, [restorationPhase]);

  // ─── Derived display data ─────────────────────────────────────────────────────
  const productsToDisplay = isSearchActive ? serverSearchResults : allProducts;

  const organizedProducts = isSearchActive
    ? groupProductsByCategory(productsToDisplay, categorySettings, language)
    : displayedCategories;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handlePageChange = (newPage: number) => {
    const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
    pageStateHook.saveCurrentState(currentScrollPosition);

    if (isSearchActive) {
      setSearchResultsPage(newPage);
    } else {
      setCurrentPage(newPage);
    }

    setTimeout(() => {
      requestAnimationFrame(() => {
        if (productsContainerRef.current) {
          productsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }, 50);
  };

  // ─── Loading / Error states ───────────────────────────────────────────────────
  if (corretorLoading || productsLoading || filterMetadataLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('messages.loading_storefront')}</p>
        </div>
      </div>
    );
  }

  if (corretorError || !corretor) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">{t('messages.user_not_found')}</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {t('messages.user_not_exists')}
        </p>
        <Button asChild>
          <a href="/">{t('messages.back_to_home')}</a>
        </Button>
      </div>
    );
  }

  const isSubscriptionOverdue = (() => {
    if (corretor.plan_status !== 'active' || !corretor.subscription_end_date) return false;
    const endDate = new Date(corretor.subscription_end_date);
    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - 2);
    return endDate < graceCutoff;
  })();

  if (corretor.is_blocked || corretor.plan_status === 'expired' || corretor.plan_status === 'suspended' || isSubscriptionOverdue) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Este catálogo não está ativo</h1>
          <p className="text-muted-foreground">
            O acesso a este catálogo está suspenso. Para compras ou dúvidas, fale diretamente com o vendedor.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/">Voltar ao Início</a>
        </Button>
      </div>
    );
  }

  logCategoryOperation('CORRETOR_PAGE_RENDER', {
    corretorId: corretor.id,
    corretorName: corretor.name,
    totalProducts,
    loadedProducts: allProducts.length,
    productsDisplayed: productsToDisplay.length,
    organizedCategories: Object.keys(organizedProducts).length,
    currentCategoryPage: currentCategoryIndex + 1,
    totalCategoryPages: totalCategories,
    isSearchActive,
    usingServerSearch: isSearchActive,
    filterMetadataCount: {
      categories: filterMetadata.categories.length,
      brands: filterMetadata.brands.length,
      genders: filterMetadata.genders.length,
      sizes: filterMetadata.sizes.length
    },
    language,
    currency
  });

  return (
    <StorefrontThemeProvider userId={corretor.id} isPaidPlan={isPaidPlan} preloadedAppearance={preloadedAppearance}>
      <div className="flex-1">
      <CorretorHeader
        corretor={corretor}
        language={language}
        currency={currency}
        cartEnabled={cartEnabled}
      />

      <div className="mt-6 mb-8">
        <Suspense fallback={<div className="h-20 bg-muted animate-pulse rounded-lg" />}>
          <PromotionalBanner corretor={corretor} />
        </Suspense>
      </div>

      <div className="container mx-auto px-4 py-1">
        <ProductSearch
          onFiltersChange={(newFilters) => {
            userInitiatedSearchRef.current = true;
            handleSearch(newFilters);
          }}
          products={allProducts}
          filterMetadata={filterMetadata}
          currency={currency}
          language={language}
          settings={settings}
          sizeTypeMapping={sizeTypeMapping}
          initialFilters={filters}
        />
      </div>

      <section className="py-2" ref={productsContainerRef}>
        <div className="container mx-auto px-4">
          {productsError ? (
            <Card className="text-center py-12">
              <CardContent>
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('messages.error_loading')}</h2>
                <p className="text-muted-foreground">{productsError}</p>
              </CardContent>
            </Card>
          ) : productsLoading && Object.keys(organizedProducts).length === 0 ? (
            <div className="space-y-12">
              {[1, 2].map((categoryIdx) => (
                <div key={categoryIdx} className="space-y-6">
                  <div className="h-8 bg-muted animate-pulse rounded w-48" />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                      <ProductCardSkeleton key={idx} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : Object.keys(organizedProducts).length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <h2 className="text-xl font-semibold mb-2">
                  {isSearchActive ? t('messages.no_results') : t('messages.no_products')}
                </h2>
                <p className="text-muted-foreground">
                  {isSearchActive
                    ? 'Tente ajustar os filtros de busca'
                    : 'Este vendedor ainda não possui produtos cadastrados'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-12">
                {Object.entries(organizedProducts).map(([categoryName, products]) => (
                  <motion.div
                    key={categoryName}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl md:text-2xl font-bold text-foreground">{categoryName}</h2>
                      <div className="flex items-center gap-2">
                        {categoryName !== t('categories.others') && (
                          <ShareCategoryButton
                            corretorSlug={corretor.slug || ''}
                            categoryName={categoryName}
                            language={language}
                            className="opacity-60 hover:opacity-100 transition-opacity"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                      {products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          corretorSlug={corretor.slug || ''}
                          currency={currency}
                          language={language}
                          inventoryEnabled={inventoryEnabled}
                          showStockOnStorefront={showStockOnStorefront}
                          cartEnabled={cartEnabled}
                          onNavigate={() => {
                            const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
                            pageStateHook.saveCurrentState(currentScrollPosition);
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {isSearchActive && (
                <div className="mt-12">
                  <PaginationControls
                    currentPage={searchResultsPage}
                    totalPages={Math.ceil(allServerSearchResults.length / pageSize)}
                    hasNextPage={searchResultsPage < Math.ceil(allServerSearchResults.length / pageSize)}
                    hasPreviousPage={searchResultsPage > 1}
                    onPageChange={handlePageChange}
                    totalProducts={allServerSearchResults.length}
                    pageSize={pageSize}
                    isLoading={serverSearchLoading}
                  />
                </div>
              )}

              {!isSearchActive && hasNextCategory && (
                <InfiniteScrollTrigger
                  onLoadMore={loadNextCategory}
                  hasNextPage={hasNextCategory}
                  isLoading={productsLoading}
                />
              )}

              {isSearchActive && serverSearchLoading && (
                <div className="mt-8 flex items-center justify-center">
                  <Loader className="h-5 w-5 animate-spin text-primary mr-2" />
                  <p className="text-sm text-muted-foreground">{t('messages.loading_search_results')}</p>
                </div>
              )}

              {isSearchActive && allServerSearchResults.length > 0 && !serverSearchLoading && (
                <div className="mt-8 p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    {allServerSearchResults.length} {allServerSearchResults.length === 1 ? t('messages.product') : t('messages.products')} {t('messages.found')}
                  </p>
                  {filters.category && filters.category !== 'todos' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('messages.showing_active_products_only')}
                    </p>
                  )}
                </div>
              )}


            </>
          )}
        </div>
      </section>
      </div>
    </StorefrontThemeProvider>
  );
}
