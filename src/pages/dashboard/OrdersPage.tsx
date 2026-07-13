import { useState, useEffect, useCallback } from 'react';
import { Package, Search, Filter, Loader as Loader2, ShoppingBag, Clock, CircleCheck as CheckCircle, DollarSign, MessageCircle, Ticket, Wallet, Truck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOrders, getOrderStats, type OrderStats } from '@/lib/orderService';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import OrderDetailsPanel from '@/components/orders/OrderDetailsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { generateWhatsAppUrl } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Order, OrderStatus } from '@/types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'Em preparo' },
  { value: 'shipped', label: 'Enviados' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'cancelled', label: 'Cancelados' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function OrdersPage() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getOrderStats> extends Promise<infer T> ? T : never | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 20;

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadOrders = useCallback(
    async (pageNum: number, replace = false) => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const filters: { status?: OrderStatus; search?: string } = {};
        if (statusFilter !== 'all') filters.status = statusFilter as OrderStatus;
        if (searchQuery.trim()) filters.search = searchQuery.trim();

        const { data, count } = await fetchOrders(user.id, LIMIT, pageNum * LIMIT, filters);
        setOrders((prev) => (replace ? data : [...prev, ...data]));
        setTotalCount(count);
        setHasMore((pageNum + 1) * LIMIT < count);
      } catch (err) {
        console.error('Failed to load orders:', err);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, statusFilter, searchQuery]
  );

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    const s = await getOrderStats(user.id);
    setStats(s);
  }, [user?.id]);

  useEffect(() => {
    setPage(0);
    loadOrders(0, true);
  }, [loadOrders]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadOrders(next);
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const handleStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    loadStats();
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Pedidos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os pedidos recebidos via WhatsApp
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total (30 dias)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-xs text-muted-foreground">Entregues</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Receita (30 dias)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingBag className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">Nenhum pedido encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
              {statusFilter !== 'all' || searchQuery
                ? 'Tente alterar os filtros para ver mais pedidos.'
                : 'Os pedidos feitos pelos seus clientes via WhatsApp aparecerão aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const itemCount = order.order_items?.length || 0;
            const whatsappUrl = order.customer_whatsapp
              ? generateWhatsAppUrl(
                  order.customer_whatsapp,
                  '',
                  order.customer_country_code || '55'
                )
              : '';

            return (
              <div
                key={order.id}
                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleOrderClick(order)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{order.customer_name}</p>
                        <OrderStatusBadge status={order.status} />
                        <Badge variant="outline" className="text-xs">
                          {order.source === 'cart' ? 'Carrinho' : 'Produto'}
                        </Badge>
                        {order.coupon_code && (
                          <Badge variant="outline" className="text-xs">
                            <Ticket className="h-3 w-3 mr-1" />
                            {order.coupon_code}
                          </Badge>
                        )}
                        {order.payment_method && (
                          <Badge variant="outline" className="text-xs">
                            <Wallet className="h-3 w-3 mr-1" />
                            {order.payment_method}
                          </Badge>
                        )}
                        {order.delivery_option && (
                          <Badge variant="outline" className="text-xs">
                            <Truck className="h-3 w-3 mr-1" />
                            {order.delivery_option}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
                        <span>{format(new Date(order.created_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-shrink-0">
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(order.total)}
                    </span>
                    {whatsappUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(whatsappUrl, '_blank');
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Carregar mais
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground pt-2">
            Mostrando {orders.length} de {totalCount} pedidos
          </p>
        </div>
      )}

      <OrderDetailsPanel
        order={selectedOrder}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
}
