import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Loader, Package, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { reorderItems } from '@/lib/buyerReorder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const STATUS_OPTIONS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'pending', label: 'Recebido' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];

function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between border border-border rounded-lg p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function BuyerOrdersPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<BuyerOrderRow[]>([]);
  const [stores, setStores] = useState<Record<string, StoreInfo>>({});
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

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

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const storeName = stores[order.store_owner_id]?.name || '';
      if (!storeName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    }
    return true;
  });

  const handleReorder = async (order: BuyerOrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const store = stores[order.store_owner_id];
    if (!store?.slug) return;

    setReorderingId(order.id);
    try {
      const { data: itemRows } = await supabaseBuyer
        .from('order_items')
        .select('product_id, product_title, quantity, selected_color, selected_size, selected_flavor, selected_variant_label')
        .eq('order_id', order.id);

      if (!itemRows || itemRows.length === 0) {
        toast.error('Não foi possível encontrar os itens deste pedido.');
        return;
      }

      clearCart();
      const result = await reorderItems(itemRows, addToCart);
      if (result.addedCount > 0) {
        toast.success(
          result.skipped.length > 0
            ? `${result.addedCount} ${result.addedCount === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho. ${result.skipped.length} não ${result.skipped.length === 1 ? 'está' : 'estão'} mais disponível.`
            : 'Itens adicionados ao carrinho!'
        );
        navigate(`/${store.slug}`);
      } else {
        toast.error('Nenhum item deste pedido está disponível no momento.');
      }
    } finally {
      setReorderingId(null);
    }
  };

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
            {!loading && orders.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por loja..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | 'all')}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {authLoading || loading ? (
              <OrdersSkeleton />
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Você ainda não fez nenhum pedido.</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum pedido encontrado com esses filtros.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
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
                      <div className="text-right flex flex-col items-end gap-1">
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
                        {store?.slug && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                            onClick={(e) => handleReorder(order, e)}
                            disabled={reorderingId === order.id}
                          >
                            {reorderingId === order.id ? (
                              <Loader className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-1 h-3 w-3" />
                            )}
                            Repetir pedido
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
