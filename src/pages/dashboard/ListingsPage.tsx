import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLogger';
import { ListingsHeader, type ViewMode, type SortOption } from '@/components/dashboard/ListingsHeader';
import { ListingsFilters } from '@/components/dashboard/ListingsFilters';
import { ListingsStatusBar } from '@/components/dashboard/ListingsStatusBar';
import { ProductGrid } from '@/components/dashboard/ProductGrid';
import { ProductListView } from '@/components/dashboard/ProductListView';
import { BulkActionsPanel } from '@/components/dashboard/BulkActionsPanel';
import { QuickEditModal } from '@/components/dashboard/QuickEditModal';
import { BulkPricingDialog } from '@/components/dashboard/BulkPricingDialog';
import { TagManagerDialog } from '@/components/dashboard/TagManagerDialog';
import { ImportProductsDialog } from '@/components/dashboard/ImportProductsDialog';
import DashboardInfiniteScrollTrigger from '@/components/dashboard/DashboardInfiniteScrollTrigger';
import { useProductListManagement } from '@/hooks/useProductListManagement';
import { useProductAnalytics } from '@/hooks/useProductAnalytics';
import { useProductTags } from '@/hooks/useProductTags';
import { ListingsErrorBoundary } from '@/components/listings/ListingsErrorBoundary';
import { ListingsErrorAlert } from '@/components/listings/ListingsErrorAlert';
import { ListingsDebugPanel } from '@/components/listings/ListingsDebugPanel';
import { ListingsHeaderSkeleton, ListingsFiltersSkeleton, ListingsStatusBarSkeleton, ProductGridSkeleton } from '@/components/dashboard/ListingsSkeletons';
import { LoadingProgressIndicator } from '@/components/listings/LoadingProgressIndicator';
import { SectionErrorBoundary } from '@/components/listings/SectionErrorBoundary';
import { exportProductsToCSV, downloadCSV } from '@/lib/csvUtils';
import { useInventoryEnabled } from '@/hooks/useInventoryEnabled';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Product } from '@/types';

export default function ListingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { inventoryEnabled } = useInventoryEnabled();
  const MAX_RETRIES = 3;

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('listings_view_mode') as ViewMode) || 'grid';
  });
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    return (localStorage.getItem('listings_sort') as SortOption) || 'recent';
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [showBulkPricing, setShowBulkPricing] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const {
    products,
    filteredProducts,
    filteredProductsByCategory,
    loading,
    error,
    errorCategory,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    availableCategories,
    updatingProductId,
    reordering,
    isReorderModeActive,
    setIsReorderModeActive,
    selectedProducts,
    setSelectedProducts,
    bulkActionLoading,
    canReorder,
    allSelected,
    totalCategoriesCount,
    displayedCategoriesCount,
    hasNextCategory,
    dismissError,
    toggleProductVisibility,
    handleSelectProduct,
    handleSelectAll,
    handleBulkVisibilityToggle,
    handleBulkCategoryChange,
    handleBulkBrandChange,
    handleBulkDelete,
    handleBulkImageCompression,
    handleDragEnd,
    initializeCategoryDisplayOrder,
    refreshProducts,
    loadNextCategory,
    loadAllCategories,
  } = useProductListManagement({ userId: user?.id });

  const { getProductAnalytics } = useProductAnalytics(30);

  const {
    tags,
    getProductTags,
    createTag,
    deleteTag,
    bulkAssignTag,
    bulkRemoveTag,
  } = useProductTags();

  useEffect(() => {
    localStorage.setItem('listings_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('listings_sort', sortOption);
  }, [sortOption]);

  useEffect(() => {
    if (!authLoading && (!user || !user.id)) {
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [authLoading, user, navigate, location]);

  const getSortedProducts = useCallback((prods: Product[]): Product[] => {
    const sorted = [...prods];
    switch (sortOption) {
      case 'recent':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'price_high':
        return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      case 'price_low':
        return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      case 'most_viewed':
        return sorted.sort((a, b) => {
          const aViews = getProductAnalytics(a.id)?.views_count || 0;
          const bViews = getProductAnalytics(b.id)?.views_count || 0;
          return bViews - aViews;
        });
      case 'low_stock':
        return sorted.sort((a, b) => (a.stock_quantity ?? 999) - (b.stock_quantity ?? 999));
      case 'alpha':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'display_order':
        return sorted.sort((a, b) => {
          const orderA = a.display_order ?? 999999;
          const orderB = b.display_order ?? 999999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      default:
        return sorted;
    }
  }, [sortOption, getProductAnalytics]);

  const getFilteredByTags = useCallback((prods: Product[]): Product[] => {
    if (selectedTagIds.length === 0) return prods;
    return prods.filter(p => {
      const productTagIds = getProductTags(p.id).map(t => t.id);
      return selectedTagIds.some(id => productTagIds.includes(id));
    });
  }, [selectedTagIds, getProductTags]);

  const displayProducts = getSortedProducts(getFilteredByTags(filteredProducts));

  const handleDuplicate = async (product: Product) => {
    if (!user?.id) return;
    try {
      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          title: `[Cópia] ${product.title}`,
          description: product.description || '',
          price: product.price,
          discounted_price: product.discounted_price,
          short_description: product.short_description,
          category: product.category,
          brand: product.brand,
          model: product.model,
          condition: product.condition,
          gender: product.gender,
          status: 'disponivel',
          is_visible_on_storefront: false,
          colors: product.colors,
          sizes: product.sizes,
          flavors: product.flavors,
          track_inventory: product.track_inventory,
          stock_quantity: product.stock_quantity,
          low_stock_threshold: product.low_stock_threshold,
          has_tiered_pricing: product.has_tiered_pricing,
          has_weight_variants: product.has_weight_variants,
          featured_image_url: product.featured_image_url,
          video_url: product.video_url,
          external_checkout_url: product.external_checkout_url,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (newProduct && product.product_images && product.product_images.length > 0) {
        const imageInserts = product.product_images.map(img => ({
          product_id: newProduct.id,
          url: img.url,
          is_featured: img.is_featured,
          media_type: img.media_type || 'image',
          display_order: img.display_order,
        }));
        await supabase.from('product_images').insert(imageInserts);
      }

      toast.success('Produto duplicado com sucesso', {
        action: {
          label: 'Editar',
          onClick: () => navigate(`/dashboard/products/${newProduct?.id}/edit`),
        },
      });
      refreshProducts();
    } catch (err) {
      console.error('Error duplicating product:', err);
      toast.error('Erro ao duplicar produto');
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteProduct || !user?.id) return;
    try {
      const { data: images } = await supabase
        .from('product_images')
        .select('url')
        .eq('product_id', deleteProduct.id);

      if (images) {
        for (const image of images) {
          const fileName = image.url.split('/').pop();
          if (fileName) {
            await supabase.storage.from('public').remove([`products/${fileName}`]);
          }
        }
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteProduct.id)
        .eq('user_id', user.id);

      if (error) throw error;
      logActivity('product.delete', `Excluiu o produto "${deleteProduct.title}"`, 'product', deleteProduct.id);
      toast.success('Produto excluído');
      refreshProducts();
    } catch (err) {
      toast.error('Erro ao excluir produto');
    } finally {
      setDeleteProduct(null);
    }
  };

  const handleQuickEditSaved = () => {
    refreshProducts();
  };

  const handleExport = () => {
    const toExport = selectedProducts.size > 0
      ? products.filter(p => selectedProducts.has(p.id))
      : products;
    const csv = exportProductsToCSV(toExport);
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `produtos_${date}.csv`);
    toast.success(`${toExport.length} produtos exportados`);
  };

  const handleBulkTagAssign = (tagId: string) => {
    const ids = Array.from(selectedProducts);
    bulkAssignTag(ids, tagId);
    setSelectedProducts(new Set());
  };

  const handleBulkTagRemove = (tagId: string) => {
    const ids = Array.from(selectedProducts);
    bulkRemoveTag(ids, tagId);
    setSelectedProducts(new Set());
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.id) return null;

  return (
    <ListingsErrorBoundary>
      <LoadingProgressIndicator
        isLoading={loading}
        isRetrying={false}
        retryCount={0}
        maxRetries={MAX_RETRIES}
        message="Carregando seus produtos..."
      />

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-5 pb-24 md:pb-6">
        {error && (
          <ListingsErrorAlert
            error={error}
            category={errorCategory}
            onDismiss={dismissError}
            onRetry={refreshProducts}
            showRetry={!loading}
          />
        )}

        <SectionErrorBoundary sectionName="cabecalho" onRetry={() => window.location.reload()}>
          {loading ? (
            <ListingsHeaderSkeleton />
          ) : (
            <ListingsHeader
              canReorder={canReorder}
              isReorderModeActive={isReorderModeActive}
              reordering={reordering}
              totalProducts={products.length}
              viewMode={viewMode}
              onToggleReorderMode={() => {
                const entering = !isReorderModeActive;
                setIsReorderModeActive(entering);
                if (entering) {
                  setSortOption('display_order');
                  initializeCategoryDisplayOrder();
                }
              }}
              onViewModeChange={setViewMode}
              onExport={handleExport}
              onImport={() => setShowImportDialog(true)}
              onManageTags={() => setShowTagManager(true)}
            />
          )}
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="filtros" onRetry={() => setSearchQuery('')}>
          {loading ? (
            <ListingsFiltersSkeleton />
          ) : (
            <ListingsFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              sortOption={sortOption}
              onSortChange={setSortOption}
              availableCategories={availableCategories}
              tags={tags}
              selectedTagIds={selectedTagIds}
              onTagFilterChange={setSelectedTagIds}
            />
          )}
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="barra de status" onRetry={() => window.location.reload()}>
          {loading ? (
            <ListingsStatusBarSkeleton />
          ) : (
            <ListingsStatusBar
              totalCount={products.length}
              filteredCount={displayProducts.length}
              selectedCount={selectedProducts.size}
              allSelected={allSelected}
              onSelectAll={handleSelectAll}
            />
          )}
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="acoes em lote" onRetry={() => setSelectedProducts(new Set())}>
          {selectedProducts.size > 0 && !loading && (
            <BulkActionsPanel
              selectedCount={selectedProducts.size}
              onBulkVisibilityToggle={handleBulkVisibilityToggle}
              onBulkCategoryChange={handleBulkCategoryChange}
              onBulkBrandChange={handleBulkBrandChange}
              onBulkDelete={handleBulkDelete}
              onBulkImageCompression={handleBulkImageCompression}
              onBulkPricing={() => setShowBulkPricing(true)}
              onBulkTagAssign={handleBulkTagAssign}
              onBulkTagRemove={handleBulkTagRemove}
              onClearSelection={() => setSelectedProducts(new Set())}
              loading={bulkActionLoading}
              userId={user.id}
              tags={tags}
            />
          )}
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="grade de produtos" onRetry={refreshProducts}>
          {loading ? (
            <ProductGridSkeleton count={6} />
          ) : displayProducts.length > 0 ? (
            viewMode === 'grid' ? (
              <ProductGrid
                products={displayProducts}
                productsByCategory={Object.keys(filteredProductsByCategory).length > 0 && sortOption === 'recent' && selectedTagIds.length === 0 ? filteredProductsByCategory : undefined}
                isDragMode={isReorderModeActive}
                reordering={reordering}
                bulkActionLoading={bulkActionLoading}
                selectedProducts={selectedProducts}
                updatingProductId={updatingProductId}
                user={user}
                inventoryEnabled={inventoryEnabled}
                onSelectProduct={handleSelectProduct}
                onToggleVisibility={toggleProductVisibility}
                onDragEnd={handleDragEnd}
                onSaveOrder={() => { setIsReorderModeActive(false); return Promise.resolve(); }}
                onCancelReorder={() => setIsReorderModeActive(false)}
                onQuickEdit={setQuickEditProduct}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteProduct}
                getProductAnalytics={getProductAnalytics}
                getProductTags={getProductTags}
              />
            ) : (
              <ProductListView
                products={displayProducts}
                selectedProducts={selectedProducts}
                updatingProductId={updatingProductId}
                user={user}
                inventoryEnabled={inventoryEnabled}
                onSelectProduct={handleSelectProduct}
                onToggleVisibility={toggleProductVisibility}
                onQuickEdit={setQuickEditProduct}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteProduct}
                getProductAnalytics={getProductAnalytics}
                getProductTags={getProductTags}
              />
            )
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Plus className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground mb-4">Nenhum produto encontrado</p>
              <Button onClick={() => navigate('/dashboard/products/new')} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Criar Primeiro Produto
              </Button>
            </div>
          )}
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="carregamento infinito" onRetry={loadNextCategory}>
          {displayProducts.length > 0 && !loading && (
            <DashboardInfiniteScrollTrigger
              onLoadMore={loadNextCategory}
              onLoadAll={loadAllCategories}
              hasNextPage={hasNextCategory}
              isLoading={loading}
              displayedCategoriesCount={displayedCategoriesCount}
              totalCategoriesCount={totalCategoriesCount}
            />
          )}
        </SectionErrorBoundary>

        <ListingsDebugPanel
          userId={user.id}
          loading={loading}
          error={error}
          productCount={products.length}
          filteredCount={displayProducts.length}
        />
      </div>

      <QuickEditModal
        product={quickEditProduct}
        open={!!quickEditProduct}
        onOpenChange={(open) => { if (!open) setQuickEditProduct(null); }}
        onSaved={handleQuickEditSaved}
      />

      <BulkPricingDialog
        open={showBulkPricing}
        onOpenChange={setShowBulkPricing}
        selectedProducts={products.filter(p => selectedProducts.has(p.id))}
        userId={user.id}
        onComplete={() => { refreshProducts(); setSelectedProducts(new Set()); }}
      />

      <TagManagerDialog
        open={showTagManager}
        onOpenChange={setShowTagManager}
        tags={tags}
        onCreateTag={createTag}
        onDeleteTag={deleteTag}
      />

      <ImportProductsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        userId={user.id}
        onComplete={refreshProducts}
      />

      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => { if (!open) setDeleteProduct(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteProduct?.title}" será excluído permanentemente junto com suas imagens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSingle} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListingsErrorBoundary>
  );
}
