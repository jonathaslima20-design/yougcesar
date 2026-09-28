import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Loader, CircleAlert as AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCorretorData } from '@/hooks/useCorretorData';
import { useProductData } from '@/hooks/useProductData';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useCorretorPageState } from '@/hooks/useCorretorPageState';
import type { CorretorPageState } from '@/contexts/CorretorPageStateContext';
import { useProductFilterMetadata } from '@/hooks/useProductFilterMetadata';
import { useServerSideProductSearch } from '@/hooks/useServerSideProductSearch';
import { useCategoryPagination } from '@/hooks/useCategoryPagination';
import { groupProductsByCategory } from '@/utils/productDisplayUtils';
import { logCategoryOperation } from '@/lib/categoryUtils';
import { useTranslation, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { updateMetaTags, getCorretorMetaTags } from '@/utils/metaTags';
import { scrollCoordinator } from '@/lib/scrollCoordinator';
import { StorefrontThemeProvider } from '@/contexts/StorefrontThemeContext';
import StorefrontThemedBody from '@/components/storefront-themes/StorefrontThemedBody';
import { useInventoryEnabledForStore } from '@/hooks/useInventoryEnabled';
import { useCheckoutSettingsForStore } from '@/hooks/useCheckoutSettings';
import { generateReferralLink } from '@/lib/referralUtils';
import { captureAffiliateClick, captureAffiliateClickBySlug } from '@/lib/affiliateUtils';

interface CorretorPageProps {
  customDomainSlug?: string;
}

export default function CorretorPage({ customDomainSlug }: CorretorPageProps = {}) {
  const { slug: paramSlug, affiliateSlug } = useParams();
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
  const savedStateRef = useRef<CorretorPageState | null>(null);

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
  const { inventoryEnabled, showStockOnStorefront, blockZeroStock } = useInventoryEnabledForStore(corretor?.id);
  const { settings: checkoutSettings } = useCheckoutSettingsForStore(corretor?.id);
  const cartEnabled = checkoutSettings.cartEnabled ?? true;

  const language: SupportedLanguage = corretor?.language || 'pt-BR';
  const currency: SupportedCurrency = corretor?.currency || 'BRL';
  const { t } = useTranslation(language);

  // Resolve affiliate attribution: the /:slug/:affiliateSlug path segment takes
  // priority over the legacy ?aff=CODE query param (both can't attribute at once).
  useEffect(() => {
    if (!corretor?.id || !corretor.affiliate_program_enabled) return;
    if (affiliateSlug) {
      captureAffiliateClickBySlug(corretor.id, affiliateSlug, location.pathname);
      return;
    }
    const affCode = searchParams.get('aff');
    if (affCode) captureAffiliateClick(corretor.id, affCode, location.pathname);
  }, [corretor?.id, corretor?.affiliate_program_enabled, affiliateSlug, searchParams, location.pathname]);

  const {
    allProducts,
    categorySettings,
    settings,
    loading: productsLoading,
    error: productsError,
    sizeTypeMapping,
    totalProducts,
    priceTiersMap,
    paginatedMode,
    paginatedProducts,
    currentProductPage,
    totalProductPages,
    loadProductPage,
  } = useProductData({
    userId: corretor?.id || '',
    language,
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

  const usePagination = paginatedMode && !isSearchActive;

  const {
    displayedCategories,
    currentCategoryIndex,
    totalCategories,
    hasNextCategory,
    loadNextCategory,
    resetToFirstCategory,
  } = useCategoryPagination({
    products: usePagination ? paginatedProducts : allProducts,
    categorySettings,
    language,
  });

  const { metadata: filterMetadata, loading: filterMetadataLoading } = useProductFilterMetadata({
    userId: corretor?.id || '',
    enabled: true
  });

  // Initialize page state hook - correctly passes searchResultsPage
  const pageStateHook = useCorretorPageState({
    slug: slug || '',
    currentPage: usePagination ? currentProductPage : currentPage,
    searchResultsPage,
    isSearchActive,
    filters,
    searchQuery,
    isRestoring: restorationPhase !== 'idle' && restorationPhase !== 'done',
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

      searchProducts(corretorId, filtersSnapshot, priceDefaults, inventoryEnabled).then((results) => {
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
  }, [isSearchActive, filters, corretor?.id, searchProducts, resetToFirstCategory, settings?.priceRange?.minPrice, settings?.priceRange?.maxPrice, inventoryEnabled]);

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
        savedStateRef.current = savedState;
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

    const savedState = savedStateRef.current;
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
    } else if (usePagination && savedState.currentPage > 1) {
      loadProductPage(savedState.currentPage).then(() => {
        setRestorationPhase('awaiting-content');
      });
      userInitiatedSearchRef.current = false;
    } else {
      if (savedState.currentPage > 1) {
        setCurrentPage(savedState.currentPage);
      }
      userInitiatedSearchRef.current = false;
      setRestorationPhase('awaiting-content');
    }
  }, [restorationPhase, corretorLoading, productsLoading, slug, usePagination, loadProductPage]);

  // Phase 3: wait for content to be rendered, then scroll
  // For filtered search: wait until server search results arrive AND pagination is applied
  // For normal view: wait until products are rendered
  useEffect(() => {
    if (restorationPhase !== 'awaiting-content') return;

    const savedState = savedStateRef.current;
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

  // Clear cached saved state once restoration is complete
  useEffect(() => {
    if (restorationPhase === 'done') {
      savedStateRef.current = null;
    }
  }, [restorationPhase]);

  // ─── Derived display data ─────────────────────────────────────────────────────
  const productsToDisplay = isSearchActive
    ? serverSearchResults
    : usePagination
      ? paginatedProducts
      : allProducts;

  const organizedProducts = isSearchActive
    ? groupProductsByCategory(productsToDisplay, categorySettings, language)
    : usePagination
      ? groupProductsByCategory(productsToDisplay, categorySettings, language)
      : displayedCategories;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handlePageChange = (newPage: number) => {
    const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
    pageStateHook.saveCurrentState(currentScrollPosition);

    if (isSearchActive) {
      setSearchResultsPage(newPage);
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (productsContainerRef.current) {
            productsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }, 50);
    } else if (usePagination) {
      loadProductPage(newPage).then(() => {
        requestAnimationFrame(() => {
          if (productsContainerRef.current) {
            productsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    } else {
      setCurrentPage(newPage);
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (productsContainerRef.current) {
            productsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }, 50);
    }
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
      <StorefrontThemedBody
        corretor={corretor}
        language={language}
        currency={currency}
        cartEnabled={cartEnabled}
        onlineSalesEnabled={!!checkoutSettings.onlinePaymentEnabled}
        allProducts={allProducts}
        filterMetadata={filterMetadata}
        settings={settings}
        sizeTypeMapping={sizeTypeMapping}
        filters={filters}
        onFiltersChange={(newFilters) => {
          userInitiatedSearchRef.current = true;
          handleSearch(newFilters);
        }}
        productsContainerRef={productsContainerRef}
        productsError={productsError}
        productsLoading={productsLoading}
        organizedProducts={organizedProducts}
        t={t}
        inventoryEnabled={inventoryEnabled}
        showStockOnStorefront={showStockOnStorefront}
        blockZeroStock={blockZeroStock}
        priceTiersMap={priceTiersMap}
        onProductNavigate={() => {
          const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
          pageStateHook.saveCurrentState(currentScrollPosition);
        }}
        isSearchActive={isSearchActive}
        searchResultsPage={searchResultsPage}
        allServerSearchResults={allServerSearchResults}
        serverSearchLoading={serverSearchLoading}
        handlePageChange={handlePageChange}
        usePagination={usePagination}
        currentProductPage={currentProductPage}
        totalProductPages={totalProductPages}
        totalProducts={totalProducts}
        pageSize={pageSize}
        hasNextCategory={hasNextCategory}
        loadNextCategory={loadNextCategory}
      />
    </StorefrontThemeProvider>
  );
}
