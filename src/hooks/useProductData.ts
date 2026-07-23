import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import type { Product, CategoryDisplaySetting } from '@/types';
import { logCategoryOperation, sanitizeCategoryName } from '@/lib/categoryUtils';
import { type SupportedLanguage } from '@/lib/i18n';
import { loadSizeTypeMapping, type SizeTypeMapping } from '@/lib/sizeTypeUtils';
import { autoPopulateSizesForUser } from '@/lib/autoPopulateSizes';
import { fetchProductPriceTiersBatch } from '@/lib/tieredPricingUtils';
import type { PriceTier } from '@/types';

const PAGINATION_THRESHOLD = 2000;
const PAGE_SIZE = 100;

const PRODUCTS_SELECT = `
  id,
  title,
  price,
  discounted_price,
  is_starting_price,
  featured_image_url,
  status,
  category,
  display_order,
  has_tiered_pricing,
  min_tiered_price,
  max_tiered_price,
  short_description,
  colors,
  sizes,
  flavors,
  has_weight_variants,
  min_variant_price,
  max_variant_price,
  external_checkout_url,
  track_inventory,
  stock_quantity,
  low_stock_threshold,
  product_images (
    id,
    url,
    associated_color
  )
`;

interface UseProductDataProps {
  userId: string;
  language?: SupportedLanguage;
}

interface UseProductDataReturn {
  allProducts: Product[];
  categorySettings: CategoryDisplaySetting[];
  settings: any;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sizeTypeMapping: SizeTypeMapping;
  totalProducts: number;
  priceTiersMap: Map<string, PriceTier[]>;
  paginatedMode: boolean;
  paginatedProducts: Product[];
  currentProductPage: number;
  totalProductPages: number;
  loadProductPage: (page: number) => Promise<void>;
}

export function useProductData({
  userId,
  language = 'pt-BR'
}: UseProductDataProps): UseProductDataReturn {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategoryDisplaySetting[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sizeTypeMapping, setSizeTypeMapping] = useState<SizeTypeMapping>({});
  const [totalProducts, setTotalProducts] = useState(0);
  const [priceTiersMap, setPriceTiersMap] = useState<Map<string, PriceTier[]>>(new Map());

  const [paginatedMode, setPaginatedMode] = useState(false);
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const [totalProductPages, setTotalProductPages] = useState(0);
  const sortedProductIdsRef = useRef<string[]>([]);

  const loadStorefrontSettings = async (userId: string) => {
    try {
      logCategoryOperation('LOADING_STOREFRONT_SETTINGS', { userId });

      const { data: storefrontSettings, error: settingsError } = await supabase
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        logCategoryOperation('STOREFRONT_SETTINGS_ERROR', settingsError);
        throw settingsError;
      }

      const effectiveSettings = {
        showFilters: true,
        showSearch: true,
        showPriceRange: true,
        showCategories: true,
        showBrands: true,
        showGender: true,
        showSizes: true,
        showStatus: true,
        showCondition: true,
        itemsPerPage: 24,
        priceRange: {
          minPrice: 10,
          maxPrice: 5000
        }
      };

      let categoryDisplaySettings: CategoryDisplaySetting[] = [];

      if (storefrontSettings?.settings) {
        if (storefrontSettings.settings.filters) {
          Object.assign(effectiveSettings, {
            ...effectiveSettings,
            ...storefrontSettings.settings.filters,
            itemsPerPage: storefrontSettings.settings.itemsPerPage || 24,
            priceRange: storefrontSettings.settings.priceRange || effectiveSettings.priceRange
          });
        } else {
          Object.assign(effectiveSettings, {
            ...effectiveSettings,
            ...storefrontSettings.settings
          });
        }

        categoryDisplaySettings = (storefrontSettings.settings.categoryDisplaySettings || [])
          .sort((a: CategoryDisplaySetting, b: CategoryDisplaySetting) => a.order - b.order);

        logCategoryOperation('CATEGORY_SETTINGS_LOADED', {
          total: categoryDisplaySettings.length,
          enabled: categoryDisplaySettings.filter(c => c.enabled).length,
          categories: categoryDisplaySettings.map(c => ({
            name: c.category,
            enabled: c.enabled,
            order: c.order
          }))
        });
      }

      return { effectiveSettings, categoryDisplaySettings };

    } catch (error) {
      logCategoryOperation('STOREFRONT_SETTINGS_LOAD_ERROR', error);
      throw error;
    }
  };

  const buildProductsQuery = (userId: string) => {
    return supabase
      .from('products')
      .select(PRODUCTS_SELECT)
      .eq('user_id', userId)
      .eq('is_visible_on_storefront', true)
      .order('display_order', { ascending: true, nullsLast: true })
      .order('id', { ascending: false });
  };

  const countProducts = async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_visible_on_storefront', true);

    if (error) throw error;
    return count || 0;
  };

  const loadAllProducts = async (userId: string) => {
    try {
      logCategoryOperation('LOADING_ALL_PRODUCTS', { userId });

      const { data: productsData, error: productsError } = await buildProductsQuery(userId);

      if (productsError) {
        throw productsError;
      }

      const products = productsData || [];

      logCategoryOperation('ALL_PRODUCTS_LOADED', {
        totalLoaded: products.length
      });

      return { products, total: products.length };

    } catch (error) {
      logCategoryOperation('LOAD_ALL_PRODUCTS_ERROR', error);
      throw error;
    }
  };

  const loadSortedProductIds = async (
    userId: string,
    categorySettings: CategoryDisplaySetting[]
  ): Promise<string[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('id, category, display_order')
      .eq('user_id', userId)
      .eq('is_visible_on_storefront', true);

    if (error) throw error;

    const categoryOrderMap = new Map<string, number>();
    categorySettings
      .filter(s => s.enabled)
      .forEach(s => categoryOrderMap.set(s.category, s.order));

    const othersLabel = language === 'en-US' ? 'Others' :
                       language === 'es-ES' ? 'Otros' : 'Outros';

    const getCategoryRank = (categories: string[] | null): number => {
      if (!categories || categories.length === 0) return 999999;
      let bestRank = 999999;
      for (const cat of categories) {
        const sanitized = sanitizeCategoryName(cat);
        if (!sanitized) continue;
        const rank = categoryOrderMap.has(sanitized)
          ? categoryOrderMap.get(sanitized)!
          : sanitized === othersLabel ? 999998 : 999000;
        if (rank < bestRank) bestRank = rank;
      }
      return bestRank === 999999 ? 999998 : bestRank;
    };

    const items = (data || []).map(item => ({
      id: item.id as string,
      rank: getCategoryRank(item.category as string[] | null),
      displayOrder: item.display_order ?? 999999,
    }));

    items.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return 0;
    });

    return items.map(i => i.id);
  };

  const loadProductsByIds = async (ids: string[]): Promise<Product[]> => {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCTS_SELECT)
      .in('id', ids);

    if (error) throw error;

    const products = data || [];
    const orderMap = new Map(ids.map((id, idx) => [id, idx]));
    products.sort((a, b) => {
      const oA = orderMap.get(a.id) ?? 999999;
      const oB = orderMap.get(b.id) ?? 999999;
      return oA - oB;
    });
    return products;
  };

  const loadAllCategories = async (userId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('user_id', userId)
      .eq('is_visible_on_storefront', true);

    if (error) throw error;

    const categories = new Set<string>();
    (data || []).forEach(item => {
      if (item.category && Array.isArray(item.category)) {
        item.category.forEach((cat: string) => {
          const sanitized = sanitizeCategoryName(cat);
          if (sanitized) categories.add(sanitized);
        });
      }
    });

    return Array.from(categories);
  };

  const extractCategoriesFromProducts = (products: Product[]): string[] => {
    const categories = new Set<string>();
    products.forEach(product => {
      if (product.category && Array.isArray(product.category)) {
        product.category.forEach(cat => {
          const sanitized = sanitizeCategoryName(cat);
          if (sanitized) categories.add(sanitized);
        });
      }
    });
    return Array.from(categories);
  };

  const syncCategorySettings = async (
    categories: string[],
    currentSettings: CategoryDisplaySetting[],
    userId: string
  ): Promise<CategoryDisplaySetting[]> => {
    try {
      const categoriesArray = categories;

      if (currentSettings.length === 0 && categoriesArray.length > 0) {
        logCategoryOperation('INITIALIZING_ALL_CATEGORIES', {
          categories: categoriesArray,
          count: categoriesArray.length
        });

        const initialSettings = categoriesArray.map((category, index) => ({
          category,
          enabled: true,
          order: index
        }));

        const { data: existingData } = await supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle();

        const mergedSettings = {
          ...existingData?.settings,
          categoryDisplaySettings: initialSettings
        };

        await supabase
          .from('user_storefront_settings')
          .upsert({
            user_id: userId,
            settings: mergedSettings
          }, {
            onConflict: 'user_id'
          });

        logCategoryOperation('ALL_CATEGORIES_INITIALIZED', {
          total: initialSettings.length
        });

        return initialSettings;
      }

      const existingCategories = new Set(currentSettings.map(s => s.category));
      const newCategories = categoriesArray.filter(
        cat => !existingCategories.has(cat)
      );

      if (newCategories.length > 0) {
        logCategoryOperation('AUTO_ADDING_NEW_CATEGORIES', {
          newCategories,
          existingCount: currentSettings.length
        });

        const updatedSettings = [
          ...currentSettings,
          ...newCategories.map((category, index) => ({
            category,
            enabled: true,
            order: currentSettings.length + index
          }))
        ];

        const { data: existingData } = await supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('user_id', userId)
          .maybeSingle();

        const mergedSettings = {
          ...existingData?.settings,
          categoryDisplaySettings: updatedSettings
        };

        await supabase
          .from('user_storefront_settings')
          .upsert({
            user_id: userId,
            settings: mergedSettings
          }, {
            onConflict: 'user_id'
          });

        logCategoryOperation('CATEGORIES_AUTO_SYNCED', {
          added: newCategories,
          total: updatedSettings.length
        });

        return updatedSettings;
      }

      return currentSettings;
    } catch (error) {
      logCategoryOperation('CATEGORY_SYNC_ERROR', error);
      return currentSettings;
    }
  };

  const fetchTiersForProducts = async (products: Product[]) => {
    const tieredIds = products.filter(p => p.has_tiered_pricing).map(p => p.id);
    if (tieredIds.length === 0) {
      setPriceTiersMap(new Map());
      return;
    }
    const tiersMap = await fetchProductPriceTiersBatch(tieredIds);
    setPriceTiersMap(tiersMap);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsData, sizeMapping] = await Promise.all([
        loadStorefrontSettings(userId),
        loadSizeTypeMapping(userId)
      ]);

      const count = await countProducts(userId);
      setTotalProducts(count);

      if (count > PAGINATION_THRESHOLD) {
        setPaginatedMode(true);
        setTotalProductPages(Math.ceil(count / PAGE_SIZE));

        const allCategories = await loadAllCategories(userId);
        const syncedCategorySettings = await syncCategorySettings(
          allCategories,
          settingsData.categoryDisplaySettings,
          userId
        );

        const sortedIds = await loadSortedProductIds(userId, syncedCategorySettings);
        sortedProductIdsRef.current = sortedIds;

        const firstPageIds = sortedIds.slice(0, PAGE_SIZE);
        const firstPageProducts = await loadProductsByIds(firstPageIds);

        await fetchTiersForProducts(firstPageProducts);

        setPaginatedProducts(firstPageProducts);
        setCurrentProductPage(1);
        setAllProducts([]);
        setSettings(settingsData.effectiveSettings);
        setCategorySettings(syncedCategorySettings);
        setSizeTypeMapping(sizeMapping);
      } else {
        setPaginatedMode(false);

        const productsResult = await loadAllProducts(userId);
        await fetchTiersForProducts(productsResult.products);

        const productCategories = extractCategoriesFromProducts(productsResult.products);
        const syncedCategorySettings = await syncCategorySettings(
          productCategories,
          settingsData.categoryDisplaySettings,
          userId
        );

        setAllProducts(productsResult.products);
        setTotalProducts(productsResult.total);
        setSettings(settingsData.effectiveSettings);
        setCategorySettings(syncedCategorySettings);
        setSizeTypeMapping(sizeMapping);
      }

      autoPopulateSizesForUser(userId).catch(err => {
        console.warn('Non-critical error auto-populating sizes:', err);
      });

    } catch (err: any) {
      logCategoryOperation('FETCH_DATA_ERROR', err);
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const loadProductPage = useCallback(async (page: number) => {
    if (!userId || !paginatedMode) return;
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const pageIds = sortedProductIdsRef.current.slice(offset, offset + PAGE_SIZE);
      const products = await loadProductsByIds(pageIds);
      setPaginatedProducts(products);
      setCurrentProductPage(page);
      await fetchTiersForProducts(products);
    } catch (err: any) {
      logCategoryOperation('LOAD_PRODUCT_PAGE_ERROR', err);
      setError(err.message || 'Error loading page');
    } finally {
      setLoading(false);
    }
  }, [userId, paginatedMode]);

  const refetch = async () => {
    setAllProducts([]);
    setPaginatedProducts([]);
    setPriceTiersMap(new Map());
    await fetchData();
  };

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  return {
    allProducts,
    categorySettings,
    settings,
    loading,
    error,
    refetch,
    sizeTypeMapping,
    totalProducts,
    priceTiersMap,
    paginatedMode,
    paginatedProducts,
    currentProductPage,
    totalProductPages,
    loadProductPage,
  };
}
