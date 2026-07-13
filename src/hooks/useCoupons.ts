import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Coupon, CouponUsage, CouponAppliesTo, CouponDiscountType } from '@/types';

export interface CouponFormData {
  code: string;
  name: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_value: number;
  max_discount_amount?: number | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  valid_from: string;
  valid_until?: string | null;
  is_active: boolean;
  applies_to: CouponAppliesTo;
  product_ids?: string[];
  category_ids?: string[];
}

export interface CouponStats {
  totalActive: number;
  totalUses: number;
  totalDiscountGiven: number;
}

export function useCoupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CouponStats>({ totalActive: 0, totalUses: 0, totalDiscountGiven: 0 });

  const fetchCoupons = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (err) {
      console.error('Error fetching coupons:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchCouponStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: allCoupons, error } = await supabase
        .from('coupons')
        .select('id, is_active, current_uses')
        .eq('user_id', user.id);

      if (error) throw error;

      const couponIds = (allCoupons || []).map(c => c.id);
      let totalDiscountGiven = 0;

      if (couponIds.length > 0) {
        const { data: usages } = await supabase
          .from('coupon_usages')
          .select('discount_applied')
          .in('coupon_id', couponIds);

        totalDiscountGiven = (usages || []).reduce((sum, u) => sum + Number(u.discount_applied || 0), 0);
      }

      setStats({
        totalActive: (allCoupons || []).filter(c => c.is_active).length,
        totalUses: (allCoupons || []).reduce((sum, c) => sum + (c.current_uses || 0), 0),
        totalDiscountGiven,
      });
    } catch (err) {
      console.error('Error fetching coupon stats:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchCoupons();
    fetchCouponStats();
  }, [user?.id, fetchCoupons, fetchCouponStats]);

  const fetchCouponById = async (couponId: string): Promise<{ coupon: Coupon; productIds: string[]; categoryIds: string[] } | null> => {
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', couponId)
        .maybeSingle();

      if (error || !coupon) return null;

      let productIds: string[] = [];
      let categoryIds: string[] = [];

      if (coupon.applies_to === 'specific_products') {
        const { data } = await supabase
          .from('coupon_products')
          .select('product_id')
          .eq('coupon_id', couponId);
        productIds = (data || []).map(r => r.product_id);
      }

      if (coupon.applies_to === 'specific_categories') {
        const { data } = await supabase
          .from('coupon_categories')
          .select('category_id')
          .eq('coupon_id', couponId);
        categoryIds = (data || []).map(r => r.category_id);
      }

      return { coupon, productIds, categoryIds };
    } catch (err) {
      console.error('Error fetching coupon:', err);
      return null;
    }
  };

  const syncRelations = async (couponId: string, appliesTo: CouponAppliesTo, productIds?: string[], categoryIds?: string[]) => {
    await supabase.from('coupon_products').delete().eq('coupon_id', couponId);
    await supabase.from('coupon_categories').delete().eq('coupon_id', couponId);

    if (appliesTo === 'specific_products' && productIds?.length) {
      await supabase
        .from('coupon_products')
        .insert(productIds.map(pid => ({ coupon_id: couponId, product_id: pid })));
    }

    if (appliesTo === 'specific_categories' && categoryIds?.length) {
      await supabase
        .from('coupon_categories')
        .insert(categoryIds.map(cid => ({ coupon_id: couponId, category_id: cid })));
    }
  };

  const createCoupon = async (formData: CouponFormData): Promise<Coupon | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('coupons')
        .insert({
          user_id: user.id,
          code: formData.code.toUpperCase().trim(),
          name: formData.name.trim(),
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          min_order_value: formData.min_order_value || 0,
          max_discount_amount: formData.discount_type === 'percentage' ? formData.max_discount_amount : null,
          max_uses: formData.max_uses || null,
          max_uses_per_customer: formData.max_uses_per_customer || null,
          valid_from: formData.valid_from,
          valid_until: formData.valid_until || null,
          is_active: formData.is_active,
          applies_to: formData.applies_to,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Ja existe um cupom com este codigo');
        } else {
          toast.error('Erro ao criar cupom');
        }
        return null;
      }

      await syncRelations(data.id, formData.applies_to, formData.product_ids, formData.category_ids);

      setCoupons(prev => [data, ...prev]);
      toast.success(`Cupom "${data.code}" criado`);
      fetchCouponStats();
      return data;
    } catch (err) {
      toast.error('Erro ao criar cupom');
      return null;
    }
  };

  const updateCoupon = async (couponId: string, formData: CouponFormData): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .update({
          code: formData.code.toUpperCase().trim(),
          name: formData.name.trim(),
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          min_order_value: formData.min_order_value || 0,
          max_discount_amount: formData.discount_type === 'percentage' ? formData.max_discount_amount : null,
          max_uses: formData.max_uses || null,
          max_uses_per_customer: formData.max_uses_per_customer || null,
          valid_from: formData.valid_from,
          valid_until: formData.valid_until || null,
          is_active: formData.is_active,
          applies_to: formData.applies_to,
          updated_at: new Date().toISOString(),
        })
        .eq('id', couponId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Ja existe um cupom com este codigo');
        } else {
          toast.error('Erro ao atualizar cupom');
        }
        return false;
      }

      await syncRelations(couponId, formData.applies_to, formData.product_ids, formData.category_ids);

      setCoupons(prev => prev.map(c => c.id === couponId ? data : c));
      toast.success(`Cupom "${data.code}" atualizado`);
      fetchCouponStats();
      return true;
    } catch (err) {
      toast.error('Erro ao atualizar cupom');
      return false;
    }
  };

  const deleteCoupon = async (couponId: string): Promise<boolean> => {
    try {
      await supabase.from('coupon_products').delete().eq('coupon_id', couponId);
      await supabase.from('coupon_categories').delete().eq('coupon_id', couponId);

      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', couponId);

      if (error) throw error;

      setCoupons(prev => prev.filter(c => c.id !== couponId));
      toast.success('Cupom excluido');
      fetchCouponStats();
      return true;
    } catch (err) {
      toast.error('Erro ao excluir cupom');
      return false;
    }
  };

  const toggleCouponActive = async (couponId: string, isActive: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', couponId);

      if (error) throw error;

      setCoupons(prev => prev.map(c => c.id === couponId ? { ...c, is_active: isActive } : c));
      toast.success(isActive ? 'Cupom ativado' : 'Cupom desativado');
      fetchCouponStats();
      return true;
    } catch (err) {
      toast.error('Erro ao alterar status do cupom');
      return false;
    }
  };

  const duplicateCoupon = async (couponId: string): Promise<Coupon | null> => {
    const source = await fetchCouponById(couponId);
    if (!source) return null;

    const newCode = generateRandomCode();
    return createCoupon({
      code: newCode,
      name: `${source.coupon.name} (copia)`,
      discount_type: source.coupon.discount_type,
      discount_value: source.coupon.discount_value,
      min_order_value: source.coupon.min_order_value,
      max_discount_amount: source.coupon.max_discount_amount,
      max_uses: source.coupon.max_uses,
      max_uses_per_customer: source.coupon.max_uses_per_customer,
      valid_from: new Date().toISOString(),
      valid_until: source.coupon.valid_until,
      is_active: true,
      applies_to: source.coupon.applies_to,
      product_ids: source.productIds,
      category_ids: source.categoryIds,
    });
  };

  const fetchCouponUsageHistory = async (couponId: string): Promise<CouponUsage[]> => {
    try {
      const { data, error } = await supabase
        .from('coupon_usages')
        .select('*')
        .eq('coupon_id', couponId)
        .order('used_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching coupon usage:', err);
      return [];
    }
  };

  return {
    coupons,
    loading,
    stats,
    fetchCoupons,
    fetchCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponActive,
    duplicateCoupon,
    fetchCouponUsageHistory,
    fetchCouponStats,
  };
}

export function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [4, 4];
  return segments
    .map(len => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
    .join('-');
}
