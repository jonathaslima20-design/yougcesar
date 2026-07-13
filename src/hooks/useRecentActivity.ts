import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityEvent {
  id: string;
  type: 'lead' | 'order' | 'view_milestone';
  title: string;
  description: string;
  timestamp: string;
  relatedId?: string;
}

interface RecentActivityData {
  events: ActivityEvent[];
  pendingOrders: number;
  loading: boolean;
}

export function useRecentActivity() {
  const { user } = useAuth();
  const [data, setData] = useState<RecentActivityData>({
    events: [],
    pendingOrders: 0,
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setData({ events: [], pendingOrders: 0, loading: false });
      return;
    }
    fetchActivity();
  }, [user?.id]);

  const fetchActivity = async () => {
    if (!user?.id) return;

    try {
      setData(prev => ({ ...prev, loading: true }));

      const { data: products } = await supabase
        .from('products')
        .select('id, title')
        .eq('user_id', user.id);

      const productIds = products?.map(p => p.id) || [];
      const productMap = new Map(products?.map(p => [p.id, p.title]) || []);
      const safeIds = productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000'];

      const [leadsRes, ordersRes, pendingRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, property_id, name, created_at')
          .in('property_id', safeIds)
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('orders')
          .select('id, customer_name, total, status, created_at')
          .eq('store_owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('store_owner_id', user.id)
          .eq('status', 'pending'),
      ]);

      const events: ActivityEvent[] = [];

      (leadsRes.data || []).forEach(lead => {
        const productTitle = productMap.get(lead.property_id) || 'Produto';
        events.push({
          id: `lead-${lead.id}`,
          type: 'lead',
          title: 'Novo lead',
          description: `${lead.name || 'Visitante'} se interessou por "${productTitle}"`,
          timestamp: lead.created_at,
          relatedId: lead.property_id,
        });
      });

      (ordersRes.data || []).forEach(order => {
        events.push({
          id: `order-${order.id}`,
          type: 'order',
          title: order.status === 'pending' ? 'Novo pedido' : `Pedido ${getStatusLabel(order.status)}`,
          description: `${order.customer_name} - R$ ${order.total.toFixed(2)}`,
          timestamp: order.created_at,
          relatedId: order.id,
        });
      });

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setData({
        events: events.slice(0, 5),
        pendingOrders: pendingRes.count || 0,
        loading: false,
      });
    } catch {
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  return data;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'confirmado';
    case 'preparing': return 'em preparo';
    case 'shipped': return 'enviado';
    case 'delivered': return 'entregue';
    case 'cancelled': return 'cancelado';
    default: return 'pendente';
  }
}
