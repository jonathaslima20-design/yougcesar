import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Loader, Package, RotateCcw, Search, ShoppingBag, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useCart } from '@/contexts/CartContext';
import { useBuyerStore } from '@/contexts/BuyerStoreContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { reorderItems, type ReorderItemInput } from '@/lib/buyerReorder';
import { useBuyAgainItems, type BuyAgainItem } from '@/hooks/useBuyAgainItems';
import { useReorderDestination } from '@/hooks/useReorderDestination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import PaymentStatusBadge from '@/components/buyer/BuyerPaymentStatusBadge';
import { BuyAgainCard, SectionTitle } from '@/components/buyer/overview/BuyerOverviewCards';
import type { OrderStatus } from '@/types';

interface BuyerOrderRow {
  id: string;
  store_owner_id: string;
  status: OrderStatus;
  payment_status: string;
  total: number;
  created_at: string;
}

interface OrderThumbnail {
  image: string | null;
  itemCount: number;
}

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
        <div key={i} className="flex items-center justify-between border border-border rounded-xl p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-md shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-40" />
            </div>
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
  const [orderThumbnails, setOrderThumbnails] = useState<Record<string, OrderThumbnail>>({});
  const { store, path, loginPath } = useBuyerStore();
  const { items: buyAgainItems } = useBuyAgainItems(customer?.id, 6, store?.id);
  const { destination, isCheckout } = useReorderDestination(store);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [buyingAgainId, setBuyingAgainId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  useEffect(() => {
    if (!customer || !store) return;

    (async () => {
      setLoading(true);
      const { data: orderRows } = await supabaseBuyer
        .from('orders')
        .select('id, store_owner_id, status, payment_status, total, created_at')
        .eq('store_owner_id', store.id)
        .order('created_at', { ascending: false });

      const rows = orderRows || [];
      setOrders(rows);

      // One thumbnail per order (its first item's image) so the list reads
      // like a real order history instead of plain text rows.
      const nonCancelledIds = rows.filter((o) => o.status !== 'cancelled').map((o) => o.id);
      if (nonCancelledIds.length > 0) {
        const { data: itemRows } = await supabaseBuyer
          .from('order_items')
          .select('order_id, product_image_url')
          .in('order_id', nonCancelledIds);

        const thumbnails: Record<string, OrderThumbnail> = {};
        (itemRows || []).forEach((item) => {
          const thumb = thumbnails[item.order_id];
          if (thumb) {
            thumb.itemCount += 1;
          } else {
            thumbnails[item.order_id] = { image: item.product_image_url, itemCount: 1 };
          }
        });
        setOrderThumbnails(thumbnails);
      }

      setLoading(false);
    })();
  }, [customer, store]);

  const handleBuyAgain = async (item: BuyAgainItem) => {
    if (!store || !destination) return;

    setBuyingAgainId(item.product_id);
    try {
      const input: ReorderItemInput = {
        product_id: item.product_id,
        product_title: item.product_title,
        quantity: 1,
        selected_color: item.selected_color,
        selected_size: item.selected_size,
        selected_flavor: item.selected_flavor,
        selected_variant_label: null,
      };
      if (isCheckout) clearCart();
      const result = await reorderItems([input], addToCart);
      if (result.addedCount > 0) {
        if (!isCheckout) toast.success('Adicionado ao carrinho!');
        navigate(destination);
      } else {
        toast.error('Este produto não está mais disponível.');
      }
    } finally {
      setBuyingAgainId(null);
    }
  };

  if (!authLoading && !customer) {
    return <Navigate to={loginPath} state={{ from: path('/pedidos') }} replace />;
  }

  const filteredOrders = orders.filter((order) => {
    return statusFilter === 'all' || order.status === statusFilter;
  });

  const handleReorder = async (order: BuyerOrderRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!store || !destination) return;

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
        if (!isCheckout || result.skipped.length > 0) toast.success(
          result.skipped.length > 0
            ? `${result.addedCount} ${result.addedCount === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho. ${result.skipped.length} não ${result.skipped.length === 1 ? 'está' : 'estão'} mais disponível.`
            : 'Itens adicionados ao carrinho!'
        );
        navigate(destination);
      } else {
        toast.error('Nenhum item deste pedido está disponível no momento.');
      }
    } finally {
      setReorderingId(null);
    }
  };

  const totalSpent = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Meus Pedidos</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seus pedidos e repita compras anteriores</p>
      </div>

      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-3 md:px-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg md:text-2xl font-bold">{orders.length}</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground truncate">Pedidos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-3 md:px-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-bold truncate">
                    {totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] md:text-xs text-muted-foreground truncate">Total gasto</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && buyAgainItems.length > 0 && (
        <div>
          <SectionTitle>Compre de novo</SectionTitle>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scroll-px-4 md:mx-0 md:px-0 md:scroll-px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {buyAgainItems.map((item) => (
              <BuyAgainCard
                key={item.product_id}
                item={item}
                busy={buyingAgainId === item.product_id}
                onBuy={() => handleBuyAgain(item)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Todos os pedidos</h2>
            {!loading && orders.length > 0 && (
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | 'all')}>
                <SelectTrigger className="w-44 h-9 text-xs" aria-label="Filtrar por status">
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
            )}
          </div>

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
                  const thumb = orderThumbnails[order.id];
                  return (
                    // Whole card is clickable through a stretched link (the ::after overlay),
                    // so the action buttons on the right are real siblings instead of
                    // interactive elements nested inside a role="button".
                    <div
                      key={order.id}
                      className="relative flex items-center justify-between border border-border bg-card rounded-xl p-3 shadow-sm hover:bg-muted/40 transition-colors"
                    >
                      <Link
                        to={path(`/pedidos/${order.id}`)}
                        className="flex items-center gap-3 min-w-0 after:absolute after:inset-0 after:content-['']"
                      >
                        <div className="h-14 w-14 rounded-lg border border-border/60 bg-white overflow-hidden shrink-0 relative">
                          {thumb?.image ? (
                            <img src={thumb.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          {thumb && thumb.itemCount > 1 && (
                            <span className="absolute bottom-0 right-0 bg-foreground text-background text-[10px] font-semibold leading-none px-1 py-0.5 rounded-tl-md">
                              +{thumb.itemCount - 1}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">Pedido #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('pt-BR')}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <OrderStatusBadge status={order.status} colorful />
                            {/* Pending payment already reads as pending status + the "Continuar pagamento" link. */}
                            {!['not_applicable', 'pending'].includes(order.payment_status) && (
                              <PaymentStatusBadge status={order.payment_status} />
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="text-right flex flex-col items-end gap-1 pointer-events-none">
                        <p className="text-base font-bold">
                          {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        {order.payment_status === 'pending' && store?.slug && (
                          <Button
                            variant="link"
                            size="sm"
                            asChild
                            className="p-0 h-auto py-2 -my-1 relative z-10 pointer-events-auto"
                          >
                            <Link to={`/${store.slug}/pedido/${order.id}/pagamento`}>Continuar pagamento</Link>
                          </Button>
                        )}
                        {store?.slug && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto py-2 -my-1 text-xs text-muted-foreground hover:text-foreground relative z-10 pointer-events-auto"
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
      </div>
    </div>
  );
}
