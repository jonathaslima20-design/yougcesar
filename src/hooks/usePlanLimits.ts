import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const FREE_PLAN_PRODUCT_LIMIT = 20;
export const FREE_PLAN_CATEGORY_LIMIT = 5;

export interface PlanLimits {
  productCount: number;
  categoryCount: number;
  productLimit: number | null;
  categoryLimit: number | null;
  isFreePlan: boolean;
  canAddProduct: boolean;
  canAddCategory: boolean;
  loading: boolean;
  refresh: () => void;
}

export function usePlanLimits(): PlanLimits {
  const { user } = useAuth();
  const [productCount, setProductCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const isFreePlan = user?.plan_status === 'free';
  const isExpired = user?.plan_status === 'expired';
  const isActivePlan = user?.plan_status === 'active';
  const isAdminOrParceiro = user?.role === 'admin' || user?.role === 'parceiro';

  const productLimit = isFreePlan ? FREE_PLAN_PRODUCT_LIMIT : null;
  const categoryLimit = isFreePlan ? FREE_PLAN_CATEGORY_LIMIT : null;

  const fetchCounts = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (isActivePlan || isAdminOrParceiro) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [productsResult, categoriesResult] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('user_product_categories')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      setProductCount(productsResult.count ?? 0);
      setCategoryCount(categoriesResult.count ?? 0);
    } catch (error) {
      console.error('Error fetching plan limit counts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isActivePlan, isAdminOrParceiro, refreshKey]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (isActivePlan || isAdminOrParceiro) {
    return {
      productCount: 0,
      categoryCount: 0,
      productLimit: null,
      categoryLimit: null,
      isFreePlan: false,
      canAddProduct: true,
      canAddCategory: true,
      loading: false,
      refresh,
    };
  }

  if (isExpired) {
    return {
      productCount,
      categoryCount,
      productLimit: 0,
      categoryLimit: 0,
      isFreePlan: false,
      canAddProduct: false,
      canAddCategory: false,
      loading,
      refresh,
    };
  }

  const canAddProduct = productLimit === null || productCount < productLimit;
  const canAddCategory = categoryLimit === null || categoryCount < categoryLimit;

  return {
    productCount,
    categoryCount,
    productLimit,
    categoryLimit,
    isFreePlan,
    canAddProduct,
    canAddCategory,
    loading,
    refresh,
  };
}
