import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Loader, Package } from 'lucide-react';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { BuyerAccountNav } from '@/components/buyer/BuyerAccountNav';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import type { OrderStatus } from '@/types';

interface BuyerOrderRow {
  id: string;
  store_owner_id: string;
  status: OrderStatus;
  payment_status: string;
  total: number;
  created_at: string;
}

interface StoreInfo {
  name: string;
  slug: string;
}

const PAYMENT_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  not_applicable: { label: 'Sem pagamento online', variant: 'outline' },
  pending: { label: 'Pagamento pendente', variant: 'secondary' },
  approved: { label: 'Pagamento aprovado', variant: 'default' },
  rejected: { label: 'Pagamento recusado', variant: 'destructive' },
  refunded: { label: 'Reembolsado', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export default function BuyerOrdersPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<BuyerOrderRow[]>([]);
  const [stores, setStores] = useState<Record<string, StoreInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) return;

    (async () => {
      setLoading(true);
      const { data: orderRows } = await supabaseBuyer
        .from('orders')
        .select('id, store_owner_id, status, payment_status, total, created_at')
        .order('created_at', { ascending: false });

      const rows = orderRows || [];
      setOrders(rows);

      const storeIds = [...new Set(rows.map((o) => o.store_owner_id))];
      if (storeIds.length > 0) {
        const { data: storeRows } = await supabaseBuyer.from('users').select('id, name, slug').in('id', storeIds);
        const map: Record<string, StoreInfo> = {};
        (storeRows || []).forEach((s: { id: string; name: string; slug: string }) => {
          map[s.id] = { name: s.name, slug: s.slug };
        });
        setStores(map);
      }

      setLoading(false);
    })();
  }, [customer]);

  if (!authLoading && !customer) {
    return <Navigate to="/conta/entrar" state={{ from: '/conta/pedidos' }} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-center mb-6">Minha Conta</h1>
        <BuyerAccountNav />

        <Card>
          <CardHeader>
            <CardTitle>Meus Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {authLoading || loading ? (
              <div className="flex justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Você ainda não fez nenhum pedido.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const paymentInfo = PAYMENT_STATUS_LABELS[order.payment_status] || PAYMENT_STATUS_LABELS.not_applicable;
                  const store = stores[order.store_owner_id];
                  return (
                    <div
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/conta/pedidos/${order.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/conta/pedidos/${order.id}`)}
                      className="flex items-center justify-between border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="font-medium">{store?.name || 'Loja'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <OrderStatusBadge status={order.status} />
                          <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        {order.payment_status === 'pending' && store?.slug && (
                          <Button
                            variant="link"
                            size="sm"
                            asChild
                            className="p-0 h-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link to={`/${store.slug}/pedido/${order.id}/pagamento`}>Continuar pagamento</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
