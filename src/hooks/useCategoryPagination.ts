import { useState, useMemo, useCallback } from 'react';
import type { Product, CategoryDisplaySetting } from '@/types';
import { groupProductsByCategory } from '@/utils/productDisplayUtils';
import type { SupportedLanguage } from '@/lib/i18n';

interface UseCategoryPaginationProps {
  products: Product[];
  categorySettings: CategoryDisplaySetting[];
  language: SupportedLanguage;
}

interface UseCategoryPaginationReturn {
  displayedCategories: Record<string, Product[]>;
  currentCategoryIndex: number;
  totalCategories: number;
  hasNextCategory: boolean;
  loadNextCategory: () => void;
  resetToFirstCategory: () => void;
}

export function useCategoryPagination({
  products,
  categorySettings,
  language,
}: UseCategoryPaginationProps): UseCategoryPaginationReturn {
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
      result[categoryName] = organizedByCategory[categoryName];
    }

    return result;
  }, [currentCategoryIndex, categoryNames, organizedByCategory]);

  const hasNextCategory = currentCategoryIndex < categoryNames.length - 1;

  const loadNextCategory = useCallback(() => {
    if (hasNextCategory) {
      setCurrentCategoryIndex(prev => prev + 1);
    }
  }, [hasNextCategory]);

  const resetToFirstCategory = useCallback(() => {
    setCurrentCategoryIndex(0);
  }, []);

  return {
    displayedCategories,
    currentCategoryIndex,
    totalCategories: categoryNames.length,
    hasNextCategory,
    loadNextCategory,
    resetToFirstCategory,
  };
}
