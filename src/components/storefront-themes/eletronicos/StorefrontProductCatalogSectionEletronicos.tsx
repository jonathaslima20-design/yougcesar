import type { RefObject } from 'react';
import { motion } from 'framer-motion';
import { Loader, CircleAlert as AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/product/ProductCardSkeleton';
import ShareCategoryButton from '@/components/corretor/ShareCategoryButton';
import PaginationControls from '@/components/corretor/PaginationControls';
import InfiniteScrollTrigger from '@/components/corretor/InfiniteScrollTrigger';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

/**
 * Product grid + pagination/infinite-scroll for the Eletrônicos theme only. No search
 * bar here — this theme drives search/filters from its own header (see
 * CorretorHeaderEletronicos.tsx + EletronicosFiltersPanel.tsx) instead. Deliberately
 * NOT shared with the "padrão" theme's copy of this section
 * (StorefrontProductCatalogSectionPadrao.tsx) — the two are allowed to drift so a
 * change made for one theme can never affect the other. Data (search/pagination
 * state) still comes from CorretorPage.tsx either way; only the rendering is separate.
 */
export default function StorefrontProductCatalogSectionEletronicos({
  corretor,
  language,
  currency,
  cartEnabled,
  productsContainerRef,
  productsError,
  productsLoading,
  organizedProducts,
  t,
  inventoryEnabled,
  showStockOnStorefront,
  blockZeroStock,
  priceTiersMap,
  onProductNavigate,
  isSearchActive,
  searchResultsPage,
  allServerSearchResults,
  serverSearchLoading,
  handlePageChange,
  usePagination,
  currentProductPage,
  totalProductPages,
  totalProducts,
  pageSize,
  hasNextCategory,
  loadNextCategory,
  filters,
}: StorefrontPageBodyProps) {
  return (
    <section className="py-2" ref={productsContainerRef as RefObject<HTMLDivElement>}>
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
                        blockZeroStock={blockZeroStock}
                        cartEnabled={cartEnabled}
                        priceTiers={priceTiersMap.get(product.id) || null}
                        onNavigate={onProductNavigate}
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

            {usePagination && (
              <div className="mt-12">
                <PaginationControls
                  currentPage={currentProductPage}
                  totalPages={totalProductPages}
                  hasNextPage={currentProductPage < totalProductPages}
                  hasPreviousPage={currentProductPage > 1}
                  onPageChange={handlePageChange}
                  totalProducts={totalProducts}
                  pageSize={100}
                  isLoading={productsLoading}
                />
              </div>
            )}

            {!isSearchActive && !usePagination && hasNextCategory && (
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
  );
}
