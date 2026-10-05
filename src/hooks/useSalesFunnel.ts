import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface FunnelStage {
  label: string;
  value: number;
  previousValue: number;
  change: number;
}

export interface SalesFunnelData {
  stages: FunnelStage[];
  loading: boolean;
}

// Counts come from get_store_funnel (migration 20261005110000), with the same
// definitions as the dashboard cards: Pedido excludes cancelled, Venda needs a
// confirmed status and, for online orders, an approved payment.
export function useSalesFunnel(periodDays: number = 30) {
  const { user } = useAuth();
  const [data, setData] = useState<SalesFunnelData>({
    stages: [],
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setData({ stages: [], loading: false });
      return;
    }
    fetchFunnelData();
  }, [user?.id, periodDays]);

  const fetchFunnelData = async () => {
    if (!user?.id) return;

    try {
      setData(prev => ({ ...prev, loading: true }));

      const { data: funnel, error } = await supabase.rpc('get_store_funnel', { p_days: periodDays });
      if (error) throw error;

      const figures = (funnel ?? {}) as {
        current: { visitors: number; views: number; contacts: number; orders: number; sales: number };
        previous: { visitors: number; views: number; contacts: number; orders: number; sales: number };
      };
      const cur = figures.current;
      const prev = figures.previous;

      const calcChange = (curr: number, previous: number) =>
        previous > 0 ? ((curr - previous) / previous) * 100 : curr > 0 ? 100 : 0;

      const build = (label: string, key: keyof typeof cur): FunnelStage => ({
        label,
        value: cur[key] ?? 0,
        previousValue: prev[key] ?? 0,
        change: calcChange(cur[key] ?? 0, prev[key] ?? 0),
      });

      setData({
        stages: [
          build('Visitantes', 'visitors'),
          build('Visualizações', 'views'),
          build('Contatos', 'contacts'),
          build('Pedidos', 'orders'),
          build('Vendas', 'sales'),
        ],
        loading: false,
      });
    } catch {
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  return data;
}
