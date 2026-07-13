import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface RecentUser {
  id: string;
  name: string;
  email: string;
  plan_status: string | null;
  created_at: string;
  avatar_url: string | null;
}

interface ExpiringSubscription {
  user_id: string;
  next_payment_date: string;
  billing_cycle: string;
  user_name: string;
  user_email: string;
}

interface WeeklySignup {
  week: string;
  count: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  growthPercentage: number;
  totalRevenue: number;
  activeSubscriptions: number;
  expiringIn7Days: number;
  expiredPlans: number;
  suspendedPlans: number;
  freePlans: number;
  newUsers30Days: number;
  recentUsers: RecentUser[];
  expiringSubscriptions: ExpiringSubscription[];
  weeklySignups: WeeklySignup[];
  monthlyRevenue: MonthlyRevenue[];
  loading: boolean;
  error: string | null;
}

export function useAdminDashboardStats() {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalUsers: 0,
    growthPercentage: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    expiringIn7Days: 0,
    expiredPlans: 0,
    suspendedPlans: 0,
    freePlans: 0,
    newUsers30Days: 0,
    recentUsers: [],
    expiringSubscriptions: [],
    weeklySignups: [],
    monthlyRevenue: [],
    loading: true,
    error: null,
  });

  const fetchAdminStats = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [
        usersRes,
        recentUsersRes,
        previousUsersRes,
        activeSubsRes,
        expiredPlansRes,
        suspendedPlansRes,
        freePlansRes,
        newUsers30Res,
        revenueRes,
        recentUsersListRes,
        expiringSubsRes,
        signupDataRes,
        revenueDataRes,
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', sixtyDaysAgo.toISOString()).lt('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan_status', 'expired').eq('role', 'corretor'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan_status', 'suspended').eq('role', 'corretor'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan_status', 'free').eq('role', 'corretor'),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('subscriptions').select('plan_price').eq('status', 'active'),
        supabase.from('users').select('id, name, email, plan_status, created_at, avatar_url').order('created_at', { ascending: false }).limit(10),
        supabase.from('subscriptions').select('user_id, next_payment_date, billing_cycle, users!inner(name, email)').eq('status', 'active').gte('next_payment_date', now.toISOString()).lte('next_payment_date', sevenDaysFromNow.toISOString()).order('next_payment_date', { ascending: true }).limit(5),
        supabase.from('users').select('created_at').gte('created_at', threeMonthsAgo.toISOString()).order('created_at', { ascending: true }),
        supabase.from('subscriptions').select('plan_price, created_at').eq('status', 'active').gte('created_at', sixMonthsAgo.toISOString()),
      ]);

      const recentCount = recentUsersRes.count || 0;
      const previousCount = previousUsersRes.count || 0;
      let growthPercentage = 0;
      if (previousCount > 0) {
        growthPercentage = ((recentCount - previousCount) / previousCount) * 100;
      } else if (recentCount > 0) {
        growthPercentage = 100;
      }

      const totalRevenue = revenueRes.data?.reduce((sum, sub) => sum + (sub.plan_price || 0), 0) || 0;

      const expiringSubscriptions: ExpiringSubscription[] = (expiringSubsRes.data || []).map((sub: any) => ({
        user_id: sub.user_id,
        next_payment_date: sub.next_payment_date,
        billing_cycle: sub.billing_cycle,
        user_name: sub.users?.name || '',
        user_email: sub.users?.email || '',
      }));

      const weeklySignups = buildWeeklySignups(signupDataRes.data || [], threeMonthsAgo);
      const monthlyRevenue = buildMonthlyRevenue(revenueDataRes.data || []);

      setStats({
        totalUsers: usersRes.count || 0,
        growthPercentage: Math.round(growthPercentage * 10) / 10,
        totalRevenue,
        activeSubscriptions: activeSubsRes.count || 0,
        expiringIn7Days: expiringSubsRes.data?.length || 0,
        expiredPlans: expiredPlansRes.count || 0,
        suspendedPlans: suspendedPlansRes.count || 0,
        freePlans: freePlansRes.count || 0,
        newUsers30Days: newUsers30Res.count || 0,
        recentUsers: recentUsersListRes.data || [],
        expiringSubscriptions,
        weeklySignups,
        monthlyRevenue,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar estatisticas',
      }));
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  return { ...stats, refresh: fetchAdminStats };
}

function buildWeeklySignups(data: { created_at: string }[], startDate: Date): WeeklySignup[] {
  const weeks: Map<string, number> = new Map();
  const now = new Date();

  let current = new Date(startDate);
  current.setDate(current.getDate() - current.getDay());

  while (current <= now) {
    const weekStart = new Date(current);
    const label = `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
    weeks.set(label, 0);
    current.setDate(current.getDate() + 7);
  }

  for (const row of data) {
    const d = new Date(row.created_at);
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const label = `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`;
    if (weeks.has(label)) {
      weeks.set(label, (weeks.get(label) || 0) + 1);
    }
  }

  return Array.from(weeks.entries()).map(([week, count]) => ({ week, count }));
}

function buildMonthlyRevenue(data: { plan_price: number; created_at: string }[]): MonthlyRevenue[] {
  const months: Map<string, number> = new Map();
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'short' });
    months.set(label, 0);
  }

  for (const row of data) {
    const d = new Date(row.created_at);
    const label = d.toLocaleDateString('pt-BR', { month: 'short' });
    if (months.has(label)) {
      months.set(label, (months.get(label) || 0) + (row.plan_price || 0));
    }
  }

  return Array.from(months.entries()).map(([month, revenue]) => ({ month, revenue }));
}
