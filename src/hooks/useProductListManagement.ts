import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { syncUserCategoriesWithStorefrontSettings } from '@/lib/utils';
import { db } from '@/lib/db';
import type { Product, CategoryDisplaySetting } from '@/types';
import { getCroppedImg } from '@/lib/image';
import { useDashboardCategoryPagination } from './useDashboardCategoryPagination';
import { errorLogger } from '@/lib/errorLogger';

interface UseProductListManagementProps {
  userId?: string;
}

interface UseProductListManagementReturn {
  products: Product[];
  filteredProducts: Product[];
  filteredProductsByCategory: Record<string, Product[]>;
  loading: boolean;
  isRetrying: boolean;
  retryCount: number;
  loadingMessage: string;
  error: string | null;
  errorCategory?: 'auth' | 'network' | 'database' | 'permission' | 'validation' | 'unknown';
  searchQuery: string;
  statusFilter: string;
  categoryFilter: string;
  availableCategories: string[];
  updatingProductId: string | null;
  reordering: boolean;
  isReorderModeActive: boolean;
  selectedProducts: Set<string>;
  bulkActionLoading: boolean;
  canReorder: boolean;
  allSelected: boolean;
  someSelected: boolean;
  totalCategoriesCount: number;
  displayedCategoriesCount: number;
  hasNextCategory: boolean;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  setCategoryFilter: (category: string) => void;
  setIsReorderModeActive: (active: boolean) => void;
  setSelectedProducts: (products: Set<string>) => void;
  dismissError: () => void;
  toggleProductVisibility: (productId: string, currentVisibility: boolean) => Promise<void>;
  handleSelectProduct: (productId: string, checked: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  handleBulkVisibilityToggle: (visible: boolean) => Promise<void>;
  handleBulkCategoryChange: (newCategories: string[]) => Promise<void>;
  handleBulkBrandChange: (newBrand: string) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleBulkImageCompression: () => Promise<void>;
  handleDragEnd: (result: any) => Promise<void>;
  initializeCategoryDisplayOrder: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  loadNextCategory: () => void;
  loadAllCategories: () => void;
}

export function useProductListManagement({ userId }: UseProductListManagementProps): UseProductListManagementReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Carregando produtos...');
  const [error, setError] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<'auth' | 'network' | 'database' | 'permission' | 'validation' | 'unknown'>('unknown');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategoryDisplaySetting[]>([]);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [isReorderModeActive, setIsReorderModeActive] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [enableCategoryPagination, setEnableCategoryPagination] = useState(true);

  // Category pagination
  const {
    displayedCategories,
    totalCategories,
    displayedCategoriesCount,
    hasNextCategory,
    loadNextCategory,
    loadAllCategories,
    resetToFirstCategory,
  } = useDashboardCategoryPagination({
    products: filteredProducts,
    categorySettings,
    language: 'pt-BR',
  });

  // Derived states
  const filteredProductsByCategory = enableCategoryPagination ? displayedCategories : {};
  const canReorder = categoryFilter !== 'todas' && filteredProducts.length > 1;
  const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.has(p.id));
  const someSelected = selectedProducts.size > 0;

  const FETCH_TIMEOUT_MS = 30000;
  const MAX_RETRIES = 3;

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error('Tempo limite para carregar produtos excedido')),
          timeoutMs
        )
      ),
    ]);
  };

  const fetchProducts = async (attemptNumber: number = 0) => {
    if (!userId) {
      const authError = 'Usuário não autenticado';
      console.warn('⚠️ Auth validation failed:', authError);
      errorLogger.logAuthError(authError, { userId });
      setError(authError);
      setErrorCategory('auth');
      setLoading(false);
      setIsRetrying(false);
      setRetryCount(0);
      return;
    }

    if (attemptNumber === 0) {
      setLoading(true);
      setIsRetrying(false);
      setRetryCount(0);
      setLoadingMessage('Carregando produtos...');
    } else {
      setIsRetrying(true);
      setRetryCount(attemptNumber);
      setLoadingMessage(`Tentando novamente (${attemptNumber}/${MAX_RETRIES})...`);
    }

    try {
      console.group(`🔄 Fetching products for user - Attempt ${attemptNumber + 1}/${MAX_RETRIES + 1}`);
      console.log('User ID:', userId);
      console.log('Timestamp:', new Date().toISOString());

      setError(null);
      setErrorCategory('unknown');

      const query = supabase
        .from('products')
        .select(`
          *,
          colors,
          sizes
        `)
        .eq('user_id', userId)
        .order('display_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false });

      const { data, error } = await withTimeout(
        db.fetch(query),
        FETCH_TIMEOUT_MS
      );

      if (error) {
        throw error;
      }

      if (!Array.isArray(data)) {
        const validationError = 'Resposta inválida do servidor - formato de dados incorreto';
        console.error('❌ Invalid data format:', { dataType: typeof data });
        errorLogger.logValidationError(validationError, {
          dataType: typeof data,
          userId,
        });
        setError(validationError);
        setErrorCategory('validation');
        console.groupEnd();
        return;
      }

      console.log('✅ Successfully fetched products:', data.length);
      setProducts(data || []);

      const categories = new Set<string>();
      data?.forEach(product => {
        if (product.category && Array.isArray(product.category)) {
          product.category.forEach(cat => categories.add(cat));
        }
      });
      setAvailableCategories(Array.from(categories).sort());
      console.log('📁 Categories found:', Array.from(categories).length);
      console.groupEnd();

      setError(null);
      setErrorCategory('unknown');
      setLoading(false);
      setIsRetrying(false);
      setRetryCount(0);

      if (attemptNumber > 0) {
        toast.success('Produtos carregados com sucesso!');
      }
    } catch (error) {
      console.groupEnd();

      const category = errorLogger.categorizeError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      errorLogger.logError(
        `Erro ao carregar produtos (tentativa ${attemptNumber + 1}/${MAX_RETRIES + 1})`,
        category,
        error,
        { userId, attemptNumber }
      );

      console.error(`❌ Error fetching products (attempt ${attemptNumber + 1}/${MAX_RETRIES + 1}):`, error);

      if (attemptNumber < MAX_RETRIES) {
        toast.error(`Erro ao carregar produtos. Tentativa ${attemptNumber + 1} de ${MAX_RETRIES}...`);
        const delay = Math.min(1000 * Math.pow(2, attemptNumber), 5000);
        setTimeout(() => fetchProducts(attemptNumber + 1), delay);
      } else {
        setError(`Falha ao carregar produtos após ${MAX_RETRIES} tentativas: ${errorMessage}`);
        setErrorCategory(category);
        setLoading(false);
        setIsRetrying(false);
        toast.error(`Erro ao carregar produtos. Toque para tentar novamente.`);
      }
    }
  };

  // Filter products based on current filters
  const filterProducts = () => {
    let filtered = [...products];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        (product.category && product.category.some(cat => 
          cat.toLowerCase().includes(query)
        )) ||
        (product.brand && product.brand.toLowerCase().includes(query))
      );
    }

    // Filter by status
    if (statusFilter !== 'todos') {
      if (statusFilter === 'visiveis') {
        filtered = filtered.filter(product => product.is_visible_on_storefront);
      } else if (statusFilter === 'ocultos') {
        filtered = filtered.filter(product => !product.is_visible_on_storefront);
      }
    }

    // Filter by category
    if (categoryFilter !== 'todas') {
      filtered = filtered.filter(product => 
        product.category && product.category.includes(categoryFilter)
      );
      
      // Sort by display_order when filtering by category
      filtered.sort((a, b) => {
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        return orderA - orderB;
      });
    }

    setFilteredProducts(filtered);
  };

  const toggleProductVisibility = async (productId: string, currentVisibility: boolean) => {
    if (!userId) {
      console.warn('⚠️ Cannot toggle visibility: user not authenticated');
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    try {
      setUpdatingProductId(productId);

      const { error } = await supabase
        .from('products')
        .update({ is_visible_on_storefront: !currentVisibility })
        .eq('id', productId)
        .eq('user_id', userId);

      if (error) throw error;

      setProducts(prev => prev.map(product =>
        product.id === productId
          ? { ...product, is_visible_on_storefront: !currentVisibility }
          : product
      ));

      toast.success(
        !currentVisibility
          ? 'Produto ativado na vitrine'
          : 'Produto removido da vitrine'
      );
    } catch (error) {
      console.error('Error updating product visibility:', error);
      toast.error('Erro ao atualizar visibilidade do produto');
    } finally {
      setUpdatingProductId(null);
    }
  };

  // Handle product selection
  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleBulkVisibilityToggle = async (visible: boolean) => {
    if (!userId) {
      console.warn('⚠️ Cannot toggle bulk visibility: user not authenticated');
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedProducts);

      if (selectedIds.length === 0) {
        toast.error('Nenhum produto selecionado');
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({ is_visible_on_storefront: visible })
        .in('id', selectedIds)
        .eq('user_id', userId);

      if (error) throw error;

      setProducts(prev => prev.map(product =>
        selectedIds.includes(product.id)
          ? { ...product, is_visible_on_storefront: visible }
          : product
      ));

      setSelectedProducts(new Set());

      try {
        await syncUserCategoriesWithStorefrontSettings(userId);
      } catch (syncError) {
        console.warn('Category sync warning:', syncError);
      }

      toast.success(`${selectedIds.length} produtos ${visible ? 'ativados' : 'ocultados'} na vitrine`);
    } catch (error) {
      console.error('Error updating bulk visibility:', error);
      toast.error('Erro ao atualizar visibilidade dos produtos');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkCategoryChange = async (newCategories: string[]) => {
    if (!userId) {
      console.warn('⚠️ Cannot change bulk category: user not authenticated');
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedProducts);

      if (selectedIds.length === 0) {
        toast.error('Nenhum produto selecionado');
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({ category: newCategories })
        .in('id', selectedIds)
        .eq('user_id', userId);

      if (error) throw error;

      setProducts(prev => prev.map(product =>
        selectedIds.includes(product.id)
          ? { ...product, category: newCategories }
          : product
      ));

      setSelectedProducts(new Set());
      toast.success(`Categoria atualizada para ${selectedIds.length} produtos`);
    } catch (error) {
      console.error('Error updating bulk category:', error);
      toast.error('Erro ao atualizar categoria dos produtos');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkBrandChange = async (newBrand: string) => {
    if (!userId) {
      console.warn('⚠️ Cannot change bulk brand: user not authenticated');
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedProducts);

      if (selectedIds.length === 0) {
        toast.error('Nenhum produto selecionado');
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({ brand: newBrand })
        .in('id', selectedIds)
        .eq('user_id', userId);

      if (error) throw error;

      setProducts(prev => prev.map(product =>
        selectedIds.includes(product.id)
          ? { ...product, brand: newBrand }
          : product
      ));

      setSelectedProducts(new Set());
      toast.success(`Marca atualizada para ${selectedIds.length} produtos`);
    } catch (error) {
      console.error('Error updating bulk brand:', error);
      toast.error('Erro ao atualizar marca dos produtos');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!userId) {
      console.warn('⚠️ Cannot delete products: user not authenticated');
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedProducts);

      if (selectedIds.length === 0) {
        toast.error('Nenhum produto selecionado');
        return;
      }

      const productsToDelete = products.filter(p => selectedIds.includes(p.id));

      for (const product of productsToDelete) {
        const { data: images } = await supabase
          .from('product_images')
          .select('url')
          .eq('product_id', product.id);

        if (images) {
          for (const image of images) {
            const fileName = image.url.split('/').pop();
            if (fileName) {
              await supabase.storage
                .from('public')
                .remove([`products/${fileName}`]);
            }
          }
        }
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedIds)
        .eq('user_id', userId);

      if (error) throw error;

      setProducts(prev => prev.filter(product => !selectedIds.includes(product.id)));
      setSelectedProducts(new Set());

      toast.success(`${selectedIds.length} produtos excluídos com sucesso`);
    } catch (error) {
      console.error('Error deleting products:', error);
      toast.error('Erro ao excluir produtos');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk image compression
  const handleBulkImageCompression = async () => {
    try {
      setBulkActionLoading(true);
      const selectedIds = Array.from(selectedProducts);
      let compressedCount = 0;
      let errorCount = 0;

      toast.success(`Iniciando compressão de imagens para ${selectedIds.length} produtos...`);

      for (const productId of selectedIds) {
        try {
          // Get all images for this product
          const { data: productImages, error: imagesError } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', productId);

          if (imagesError) {
            console.error(`Error fetching images for product ${productId}:`, imagesError);
            errorCount++;
            continue;
          }

          if (!productImages || productImages.length === 0) {
            continue;
          }

          // Process each image
          for (const image of productImages) {
            try {
              // Check current image size
              const response = await fetch(image.url);
              const blob = await response.blob();
              
              // If image is already under 400KB, skip compression
              if (blob.size <= 400 * 1024) {
                console.log(`Image ${image.id} already optimized (${(blob.size / 1024).toFixed(1)}KB)`);
                continue;
              }

              console.log(`Compressing image ${image.id} from ${(blob.size / 1024).toFixed(1)}KB`);

              // Create canvas from image
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = image.url;
              });

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                throw new Error('Could not get canvas context');
              }

              // Set canvas dimensions to image dimensions
              canvas.width = img.width;
              canvas.height = img.height;

              // Draw image on canvas
              ctx.drawImage(img, 0, 0);

              // Use the existing optimization function
              const optimizedBlob = await optimizeImageSize(canvas, 400 * 1024);

              // Upload optimized image
              const fileName = `${productId}-optimized-${Date.now()}.jpg`;
              const filePath = `products/${fileName}`;

              const { error: uploadError } = await supabase.storage
                .from('public')
                .upload(filePath, optimizedBlob);

              if (uploadError) {
                throw uploadError;
              }

              const { data: { publicUrl } } = supabase.storage
                .from('public')
                .getPublicUrl(filePath);

              // Update image URL in database
              const { error: updateError } = await supabase
                .from('product_images')
                .update({ url: publicUrl })
                .eq('id', image.id);

              if (updateError) {
                throw updateError;
              }

              // If this is the featured image, update product's featured image URL
              if (image.is_featured) {
                const { error: productUpdateError } = await supabase
                  .from('products')
                  .update({ featured_image_url: publicUrl })
                  .eq('id', productId);

                if (productUpdateError) {
                  console.error('Error updating product featured image:', productUpdateError);
                }
              }

              // Delete old image from storage
              const oldFileName = image.url.split('/').pop();
              if (oldFileName) {
                await supabase.storage
                  .from('public')
                  .remove([`products/${oldFileName}`]);
              }

              compressedCount++;
              console.log(`✅ Image ${image.id} compressed successfully to ${(optimizedBlob.size / 1024).toFixed(1)}KB`);

            } catch (imageError) {
              console.error(`Error compressing image ${image.id}:`, imageError);
              errorCount++;
            }
          }

        } catch (productError) {
          console.error(`Error processing product ${productId}:`, productError);
          errorCount++;
        }
      }

      // Update local state to reflect changes
      await refreshProducts();
      setSelectedProducts(new Set());

      if (compressedCount > 0) {
        toast.success(`${compressedCount} imagens comprimidas com sucesso!`);
      }
      
      if (errorCount > 0) {
        toast.warning(`${errorCount} imagens não puderam ser comprimidas. Verifique o console para detalhes.`);
      }

      if (compressedCount === 0 && errorCount === 0) {
        toast.success('Todas as imagens já estão otimizadas (≤ 400KB)');
      }

    } catch (error) {
      console.error('Error in bulk image compression:', error);
      toast.error('Erro ao comprimir imagens');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Helper function to optimize image size (extracted from image.ts logic)
  const optimizeImageSize = async (canvas: HTMLCanvasElement, maxSizeBytes: number): Promise<Blob> => {
    const MAX_QUALITY = 0.95;
    const MIN_QUALITY = 0.1;
    const QUALITY_STEP = 0.05;
    
    let quality = MAX_QUALITY;
    let blob: Blob | null = null;
    
    while (quality >= MIN_QUALITY) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (result) => resolve(result),
          'image/jpeg',
          quality
        );
      });
      
      if (!blob) {
        throw new Error('Failed to create blob from canvas');
      }
      
      if (blob.size <= maxSizeBytes) {
        return blob;
      }
      
      quality -= QUALITY_STEP;
    }
    
    // If we couldn't get under the size limit, return the last blob
    if (blob) {
      return blob;
    }
    
    throw new Error('Failed to optimize image');
  };

  const handleDragEnd = async (result: any) => {
    if (!userId) {
      console.warn('⚠️ Cannot reorder products: user not authenticated');
      toast.error('Usuário não autenticado. Faça login novamente.');
      return;
    }

    if (!result.destination) {
      console.log('🚫 Drag cancelled - no destination');
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      console.log('🚫 Drag cancelled - same position');
      return;
    }

    console.log('🧩 SLIDING PUZZLE REORDER:', {
      sourceIndex,
      destinationIndex,
      productId: result.draggableId,
      direction: sourceIndex < destinationIndex ? 'moving down' : 'moving up',
      filteredProductsCount: filteredProducts.length
    });

    try {
      setReordering(true);

      // Step 1: Create optimistic update for immediate UI feedback
      const reorderedFilteredProducts = Array.from(filteredProducts);
      // 🧩 SLIDING PUZZLE LOGIC: Reorder only within the filtered list
      // This creates a sliding puzzle effect where products shift to fill gaps
      
      // Step 1: Create the new order within filtered products (sliding puzzle effect)
      const reorderedFiltered = Array.from(filteredProducts);
      const [draggedProduct] = reorderedFiltered.splice(sourceIndex, 1);
      reorderedFiltered.splice(destinationIndex, 0, draggedProduct);
      
      // Step 2: Update display_order only for the filtered products
      // This maintains the sliding puzzle behavior within the current view
      const updatePromises = reorderedFiltered.map((product, index) => {
        const newDisplayOrder = index;
        console.log(`🧩 Updating ${product.title}: position ${index}`);
        
        return supabase
          .from('products')
          .update({ display_order: newDisplayOrder })
          .eq('id', product.id)
          .eq('user_id', userId);
      });

      // Step 3: Execute all updates in parallel
      const retryPromises = updatePromises.map(promise => 
        db.retry(() => promise)
      );
      const results = await Promise.allSettled(retryPromises);
      const failures = results.filter(result => result.status === 'rejected');
      
      if (failures.length > 0) {
        console.error('❌ Some sliding puzzle updates failed:', failures);
        throw new Error(`Falha ao atualizar ${failures.length} de ${reorderedFiltered.length} produtos`);
      }

      // Step 4: Update local state to reflect the new sliding puzzle order
      setFilteredProducts(reorderedFiltered);
      
      // Update the main products array with new display_order values
      setProducts(prev => prev.map(product => {
        const reorderedProduct = reorderedFiltered.find(rp => rp.id === product.id);
        if (reorderedProduct) {
          const newIndex = reorderedFiltered.findIndex(rp => rp.id === product.id);
          return { ...product, display_order: newIndex };
        }
        return product;
      }));

      console.log('✅ SLIDING PUZZLE REORDER SUCCESS');
      console.log('✅ REORDENAÇÃO CONCLUÍDA COM SUCESSO');
      toast.success(`"${draggedProduct.title}" movido para posição ${destinationIndex + 1}`);
      
    } catch (error) {
      console.error('❌ Erro na reordenação de produtos:', error);
      toast.error('Erro ao reordenar produtos. Tentando novamente...');
      
      // Revert to original state on error
      await refreshProducts();
    } finally {
      setReordering(false);
    }
  };

  const initializeCategoryDisplayOrder = async () => {
    if (!userId || filteredProducts.length === 0) return;

    const allUninitialized = filteredProducts.every(
      p => p.display_order === null || p.display_order === 0
    );

    if (!allUninitialized) return;

    const sorted = [...filteredProducts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const updatePromises = sorted.map((product, index) =>
      supabase
        .from('products')
        .update({ display_order: index })
        .eq('id', product.id)
        .eq('user_id', userId)
    );

    const results = await Promise.allSettled(
      updatePromises.map(p => db.retry(() => p))
    );
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length === 0) {
      const updated = sorted.map((p, i) => ({ ...p, display_order: i }));
      setFilteredProducts(updated);
      setProducts(prev =>
        prev.map(p => {
          const idx = sorted.findIndex(s => s.id === p.id);
          return idx >= 0 ? { ...p, display_order: idx } : p;
        })
      );
    }
  };

  // Enhanced refresh function
  const refreshProducts = async () => {
    setLoading(true);
    await fetchProducts();
    setLoading(false);
  };

  // Dismiss error
  const dismissError = () => {
    setError(null);
    setErrorCategory('unknown');
  };

  // Effects
  useEffect(() => {
    if (userId) {
      fetchProducts();
    }
  }, [userId]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, statusFilter, categoryFilter]);

  // Reset reorder mode when filters change
  useEffect(() => {
    setIsReorderModeActive(false);
    setSelectedProducts(new Set()); // Clear selections when filters change
    resetToFirstCategory(); // Reset category pagination
  }, [categoryFilter, searchQuery, statusFilter]);

  // Load category settings
  useEffect(() => {
    const loadCategorySettings = async () => {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('category_display_settings')
          .select('*')
          .eq('user_id', userId);

        if (error) throw error;
        setCategorySettings(data || []);
      } catch (error) {
        console.error('Error loading category settings:', error);
        setCategorySettings([]);
      }
    };

    loadCategorySettings();
  }, [userId]);

  return {
    products,
    filteredProducts,
    filteredProductsByCategory,
    loading,
    isRetrying,
    retryCount,
    loadingMessage,
    error,
    errorCategory,
    searchQuery,
    statusFilter,
    categoryFilter,
    availableCategories,
    updatingProductId,
    reordering,
    isReorderModeActive,
    selectedProducts,
    bulkActionLoading,
    canReorder,
    allSelected,
    someSelected,
    totalCategoriesCount: totalCategories,
    displayedCategoriesCount,
    hasNextCategory,
    setSearchQuery,
    setStatusFilter,
    setCategoryFilter,
    setIsReorderModeActive,
    setSelectedProducts,
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
  };
}