import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface RevenueStats {
  totalRevenue: number;
  previousRevenue: number;
  revenueChange: number;
  averageTicket: number;
  totalDelivered: number;
  weeklyRevenue: { date: string; revenue: number }[];
  loading: boolean;
}

export function useDashboardRevenue(periodDays: number = 30) {
  const { user } = useAuth();
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    previousRevenue: 0,
    revenueChange: 0,
    averageTicket: 0,
    totalDelivered: 0,
    weeklyRevenue: [],
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }
    fetchRevenue();
  }, [user?.id, periodDays]);

  const fetchRevenue = async () => {
    if (!user?.id) return;

    try {
      setStats(prev => ({ ...prev, loading: true }));

      const now = new Date();
      const startDate = new Date();
      startDate.setDate(now.getDate() - periodDays);
      const previousStartDate = new Date();
      previousStartDate.setDate(now.getDate() - periodDays * 2);

      const [currentResponse, previousResponse] = await Promise.all([
        supabase
          .from('orders')
          .select('total, created_at, status')
          .eq('store_owner_id', user.id)
          .gte('created_at', startDate.toISOString())
          .in('status', ['delivered', 'confirmed', 'preparing', 'shipped']),

        supabase
          .from('orders')
          .select('total')
          .eq('store_owner_id', user.id)
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString())
          .in('status', ['delivered', 'confirmed', 'preparing', 'shipped']),
      ]);

      const currentOrders = currentResponse.data || [];
      const previousOrders = previousResponse.data || [];

      const totalRevenue = currentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const previousRevenue = previousOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const revenueChange = previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : totalRevenue > 0 ? 100 : 0;
      const totalDelivered = currentOrders.filter(o => o.status === 'delivered').length;
      const averageTicket = currentOrders.length > 0 ? totalRevenue / currentOrders.length : 0;

      // Chart data: show last 7 data points regardless of period
      const chartDays = Math.min(periodDays, 7);
      const weeklyRevenue: { date: string; revenue: number }[] = [];
      const dayStep = Math.max(Math.floor(periodDays / 7), 1);

      for (let i = 6; i >= 0; i--) {
        const dayOffset = i * dayStep;
        const day = new Date();
        day.setDate(now.getDate() - dayOffset);
        const dayStr = day.toISOString().split('T')[0];
        const label = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;

        if (dayStep === 1) {
          const dayRevenue = currentOrders
            .filter(o => o.created_at.startsWith(dayStr))
            .reduce((sum, o) => sum + (o.total || 0), 0);
          weeklyRevenue.push({ date: label, revenue: dayRevenue });
        } else {
          const rangeStart = new Date(day);
          rangeStart.setDate(rangeStart.getDate() - dayStep + 1);
          const rangeStartStr = rangeStart.toISOString().split('T')[0];

          const rangeRevenue = currentOrders
            .filter(o => {
              const orderDate = o.created_at.split('T')[0];
              return orderDate >= rangeStartStr && orderDate <= dayStr;
            })
            .reduce((sum, o) => sum + (o.total || 0), 0);
          weeklyRevenue.push({ date: label, revenue: rangeRevenue });
        }
      }

      setStats({
        totalRevenue,
        previousRevenue,
        revenueChange,
        averageTicket,
        totalDelivered,
        weeklyRevenue,
        loading: false,
      });
    } catch {
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  return stats;
}
