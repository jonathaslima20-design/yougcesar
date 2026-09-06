import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Loader, Package, RotateCcw, Search, ShoppingBag, ShoppingCart, Award, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { reorderItems, type ReorderItemInput } from '@/lib/buyerReorder';
import { getBuyerTier, type BuyerTier } from '@/lib/buyerTier';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import type { OrderStatus } from '@/types';

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg';

const TIER_STYLES: Record<BuyerTier, { bg: string; icon: string; bar: string }> = {
  bronze: { bg: 'bg-amber-100 dark:bg-amber-950/40', icon: 'text-amber-700 dark:text-amber-500', bar: 'bg-amber-600' },
  prata: { bg: 'bg-slate-100 dark:bg-slate-800/60', icon: 'text-slate-500 dark:text-slate-300', bar: 'bg-slate-400' },
  ouro: { bg: 'bg-yellow-100 dark:bg-yellow-950/40', icon: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500' },
};

interface BuyAgainItem {
  product_id: string;
  product_title: string;
  product_image_url: string | null;
  selected_color: string | null;
  selected_size: string | null;
  selected_flavor: string | null;
  store_owner_id: string;
  timesOrdered: number;
  lastOrderedAt: string;
}

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

interface OrderThumbnail {
  image: string | null;
  itemCount: number;
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
  const [stores, setStores] = useState<Record<string, StoreInfo>>({});
  const [orderThumbnails, setOrderThumbnails] = useState<Record<string, OrderThumbnail>>({});
  const [buyAgainItems, setBuyAgainItems] = useState<BuyAgainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [buyingAgainId, setBuyingAgainId] = useState<string | null>(null);
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

      // "Compre de novo": aggregate past order items into distinct products,
      // ranked by how often each was bought, so the buyer can re-add a
      // favorite with one click instead of digging through old orders.
      const nonCancelledIds = rows.filter((o) => o.status !== 'cancelled').map((o) => o.id);
      if (nonCancelledIds.length > 0) {
        const { data: itemRows } = await supabaseBuyer
          .from('order_items')
          .select('order_id, product_id, product_title, product_image_url, selected_color, selected_size, selected_flavor, selected_variant_label')
          .in('order_id', nonCancelledIds);

        const orderMeta = new Map(rows.map((o) => [o.id, o]));
        const aggregated = new Map<string, BuyAgainItem>();

        // One thumbnail per order (its first item's image) so the list reads
        // like a real order history instead of plain text rows.
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

        (itemRows || []).forEach((item) => {
          // Weight-variant purchases don't record which variant was bought,
          // so there's no safe price to re-add them at — same rule buyerReorder.ts uses.
          if (item.selected_variant_label) return;
          const order = orderMeta.get(item.order_id);
          if (!order) return;

          const existing = aggregated.get(item.product_id);
          if (existing) {
            existing.timesOrdered += 1;
            if (order.created_at > existing.lastOrderedAt) {
              existing.lastOrderedAt = order.created_at;
              existing.product_title = item.product_title;
              existing.product_image_url = item.product_image_url;
              existing.selected_color = item.selected_color;
              existing.selected_size = item.selected_size;
              existing.selected_flavor = item.selected_flavor;
              existing.store_owner_id = order.store_owner_id;
            }
          } else {
            aggregated.set(item.product_id, {
              product_id: item.product_id,
              product_title: item.product_title,
              product_image_url: item.product_image_url,
              selected_color: item.selected_color,
              selected_size: item.selected_size,
              selected_flavor: item.selected_flavor,
              store_owner_id: order.store_owner_id,
              timesOrdered: 1,
              lastOrderedAt: order.created_at,
            });
          }
        });

        const sorted = Array.from(aggregated.values())
          .sort((a, b) => b.timesOrdered - a.timesOrdered || (a.lastOrderedAt < b.lastOrderedAt ? 1 : -1))
          .slice(0, 6);

        setBuyAgainItems(sorted);
      }

      setLoading(false);
    })();
  }, [customer]);

  const handleBuyAgain = async (item: BuyAgainItem) => {
    const store = stores[item.store_owner_id];
    if (!store?.slug) return;

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
      const result = await reorderItems([input], addToCart);
      if (result.addedCount > 0) {
        toast.success('Adicionado ao carrinho!');
        navigate(`/${store.slug}`);
      } else {
        toast.error('Este produto não está mais disponível.');
      }
    } finally {
      setBuyingAgainId(null);
    }
  };

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

  const totalSpent = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  const tierInfo = getBuyerTier(totalSpent);
  const tierStyle = TIER_STYLES[tierInfo.tier];

  const favoriteStoreName = (() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.store_owner_id] = (counts[o.store_owner_id] || 0) + 1;
    });
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return topId ? stores[topId]?.name || null : null;
  })();

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Meus Pedidos</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seus pedidos e repita compras anteriores</p>
      </div>

      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
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
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', tierStyle.bg)}>
                  <Award className={cn('h-4 w-4', tierStyle.icon)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg md:text-2xl font-bold truncate">{tierInfo.label}</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                    {tierInfo.amountToNext != null
                      ? `Faltam ${tierInfo.amountToNext.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} p/ ${tierInfo.nextLabel}`
                      : 'Nível máximo'}
                  </p>
                </div>
              </div>
              <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', tierStyle.bar)}
                  style={{ width: `${tierInfo.progressPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-3 md:px-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-bold truncate">{favoriteStoreName || '—'}</p>
                  <p className="text-[11px] md:text-xs text-muted-foreground truncate">Loja favorita</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && buyAgainItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Compre de novo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {buyAgainItems.map((item) => (
                <div
                  key={item.product_id}
                  className="flex flex-col gap-2 border border-border rounded-lg p-3 w-36 shrink-0"
                >
                  <div className="w-full aspect-square bg-white rounded-md overflow-hidden border border-border/60">
                    <img
                      src={item.product_image_url || FALLBACK_IMAGE}
                      alt={item.product_title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" title={item.product_title}>
                      {item.product_title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {stores[item.store_owner_id]?.name || 'Loja'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={buyingAgainId === item.product_id}
                    onClick={() => handleBuyAgain(item)}
                  >
                    {buyingAgainId === item.product_id ? (
                      <Loader className="h-3 w-3 animate-spin" />
                    ) : (
                      'Comprar de novo'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  const thumb = orderThumbnails[order.id];
                  return (
                    <div
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/conta/pedidos/${order.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/conta/pedidos/${order.id}`)}
                      className="flex items-center justify-between border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-14 w-14 rounded-md border border-border/60 bg-white overflow-hidden shrink-0 relative">
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
                          <p className="font-medium truncate">{store?.name || 'Loja'}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString('pt-BR')}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <OrderStatusBadge status={order.status} />
                            <Badge variant={paymentInfo.variant}>{paymentInfo.label}</Badge>
                          </div>
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
  );
}
