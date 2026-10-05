import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// `leads` holds contatos per day (formulários and pedidos de contato, no WhatsApp clicks).
// Counts come from get_store_daily_series (migration 20261005110000).
export interface ChartDataPoint {
  date: string;
  views: number;
  leads: number;
}

interface UseViewsAndLeadsChartReturn {
  data: ChartDataPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useViewsAndLeadsChart(days: number = 7): UseViewsAndLeadsChartReturn {
  const { user } = useAuth();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = async () => {
    if (!user?.id) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: series, error: rpcError } = await supabase.rpc('get_store_daily_series', { p_days: days });
      if (rpcError) throw rpcError;

      const points = (series ?? []) as Array<{ date: string; views: number; contacts: number }>;
      setData(points.map(p => ({ date: p.date, views: p.views, leads: p.contacts })));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching chart data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do gráfico');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [user?.id, days]);

  const refresh = () => {
    fetchChartData();
  };

  return { data, loading, error, refresh };
}
