import { useState, useMemo, useCallback } from 'react';
import type { Product, CategoryDisplaySetting } from '@/types';
import { groupProductsByCategory } from '@/utils/productDisplayUtils';
import type { SupportedLanguage } from '@/lib/i18n';

interface UseDashboardCategoryPaginationProps {
  products: Product[];
  categorySettings: CategoryDisplaySetting[];
  language: SupportedLanguage;
  itemsPerCategory?: number;
}

interface UseDashboardCategoryPaginationReturn {
  displayedCategories: Record<string, Product[]>;
  currentCategoryIndex: number;
  totalCategories: number;
  hasNextCategory: boolean;
  displayedCategoriesCount: number;
  loadNextCategory: () => void;
  loadAllCategories: () => void;
  resetToFirstCategory: () => void;
}

export function useDashboardCategoryPagination({
  products,
  categorySettings,
  language,
  itemsPerCategory = Infinity,
}: UseDashboardCategoryPaginationProps): UseDashboardCategoryPaginationReturn {
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

  const organizedByCategory = useMemo(() => {
    return groupProductsByCategory(products, categorySettings, language);
  }, [products, categorySettings, language]);

  const categoryNames = useMemo(() => {
    return Object.keys(organizedByCategory);
  }, [organizedByCategory]);

  const displayedCategories = useMemo(() => {
    const result: Record<string, Product[]> = {};

    for (let i = 0; i <= currentCategoryIndex && i < categoryNames.length; i++) {
      const categoryName = categoryNames[i];
      const categoryProducts = organizedByCategory[categoryName];

      // Limit items per category if specified
      if (itemsPerCategory !== Infinity) {
        result[categoryName] = categoryProducts.slice(0, itemsPerCategory);
      } else {
        result[categoryName] = categoryProducts;
      }
    }

    return result;
  }, [currentCategoryIndex, categoryNames, organizedByCategory, itemsPerCategory]);

  const displayedCategoriesCount = useMemo(() => {
    return Object.keys(displayedCategories).length;
  }, [displayedCategories]);

  const hasNextCategory = currentCategoryIndex < categoryNames.length - 1;

  const loadNextCategory = useCallback(() => {
    if (hasNextCategory) {
      setCurrentCategoryIndex(prev => prev + 1);
    }
  }, [hasNextCategory]);

  const loadAllCategories = useCallback(() => {
    setCurrentCategoryIndex(categoryNames.length - 1);
  }, [categoryNames.length]);

  const resetToFirstCategory = useCallback(() => {
    setCurrentCategoryIndex(0);
  }, []);

  return {
    displayedCategories,
    currentCategoryIndex,
    totalCategories: categoryNames.length,
    hasNextCategory,
    displayedCategoriesCount,
    loadNextCategory,
    loadAllCategories,
    resetToFirstCategory,
  };
}
