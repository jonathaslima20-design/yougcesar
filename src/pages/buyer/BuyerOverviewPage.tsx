import { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useCart } from '@/contexts/CartContext';
import { useBuyerAccountSummary } from '@/hooks/useBuyerAccountSummary';
import { useBuyerStore } from '@/contexts/BuyerStoreContext';
import { useBuyAgainItems, type BuyAgainItem } from '@/hooks/useBuyAgainItems';
import { useCustomerCoupons } from '@/hooks/useCustomerCoupons';
import { useReorderDestination } from '@/hooks/useReorderDestination';
import {
  ActiveOrderCard,
  BuyAgainCard,
  CashbackCard,
  DefaultAddressCard,
  OffersCard,
  RecentOrderRowCard,
  SectionTitle,
  type ActiveOrder,
} from '@/components/buyer/overview/BuyerOverviewCards';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { fetchCustomerAddresses, type CustomerAddress } from '@/lib/customerAddressService';
import { reorderItems, type ReorderItemInput } from '@/lib/buyerReorder';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrderStatus } from '@/types';

interface RecentOrder {
  id: string;
  store_owner_id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
}

export default function BuyerOverviewPage() {
  const { customer, loading: authLoading } = useBuyerAuth();
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();
  const { store, path, loginPath, cashbackEnabled: cashbackAvailable, cashbackRate } = useBuyerStore();
  const { coupons } = useCustomerCoupons(store?.slug);
  const { destination, isCheckout } = useReorderDestination(store);
  const summary = useBuyerAccountSummary(customer?.id, store?.id);
  const { items: buyAgainItems } = useBuyAgainItems(customer?.id, 4, store?.id);
  const [buyingAgainId, setBuyingAgainId] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, { image: string | null; itemCount: number }>>({});
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [defaultAddress, setDefaultAddress] = useState<CustomerAddress | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Buying this product again means buying just it: start from an empty cart so
      // leftovers from earlier browsing don't ride along into the checkout.
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

  useEffect(() => {
    if (!customer || !store) return;

    (async () => {
      setLoading(true);
      const [{ data: orderRows }, { data: activeRows }, addresses] = await Promise.all([
        supabaseBuyer
          .from('orders')
          .select('id, store_owner_id, status, total, created_at')
          .eq('store_owner_id', store.id)
          .order('created_at', { ascending: false })
          .limit(3),
        // The in-flight order (not delivered/cancelled, and not a dead payment),
        // shown as the hero card.
        supabaseBuyer
          .from('orders')
          .select('id, status, payment_status, total, created_at, delivery_scope, carrier, tracking_code')
          .eq('store_owner_id', store.id)
          .in('status', ['pending', 'confirmed', 'preparing', 'shipped'])
          .not('payment_status', 'in', '(rejected,cancelled,refunded)')
          .order('created_at', { ascending: false })
          .limit(1),
        fetchCustomerAddresses(customer.id).catch(() => []),
      ]);

      const rows = orderRows || [];
      setRecentOrders(rows);
      setActiveOrder((activeRows && activeRows[0]) || null);

      // First item's photo per recent order, so the list reads like real order history.
      if (rows.length > 0) {
        const { data: itemRows } = await supabaseBuyer
          .from('order_items')
          .select('order_id, product_image_url')
          .in('order_id', rows.map((o) => o.id));
        const map: Record<string, { image: string | null; itemCount: number }> = {};
        (itemRows || []).forEach((item) => {
          const t = map[item.order_id];
          if (t) t.itemCount += 1;
          else map[item.order_id] = { image: item.product_image_url, itemCount: 1 };
        });
        setThumbs(map);
      }
      setDefaultAddress(addresses.find((a) => a.is_default) || addresses[0] || null);

      setLoading(false);
    })();
  }, [customer, store]);

  if (!authLoading && !customer) {
    return <Navigate to={loginPath} state={{ from: path() }} replace />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="sr-only">Visão geral da sua conta</h1>
      {activeOrder && store && (
        <ActiveOrderCard order={activeOrder} storeSlug={store.slug} orderPath={path(`/pedidos/${activeOrder.id}`)} />
      )}

      {cashbackAvailable && (
        <CashbackCard
          balance={summary.cashbackTotal}
          ratePercent={cashbackRate}
          loading={summary.loading}
          cashbackPath={path('/cashback')}
        />
      )}

      <OffersCard coupons={coupons} />

      {buyAgainItems.length > 0 && (
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
        <SectionTitle
          action={
            <Link to={path('/pedidos')} className="text-xs text-primary hover:underline flex items-center gap-1 py-2 -my-2">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          Pedidos recentes
        </SectionTitle>
        {authLoading || loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Você ainda não fez nenhum pedido.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <RecentOrderRowCard key={order.id} order={order} href={path(`/pedidos/${order.id}`)} thumb={thumbs[order.id]} />
            ))}
          </div>
        )}
      </div>

      {defaultAddress && (
        <div>
          <SectionTitle>Endereço padrão</SectionTitle>
          <DefaultAddressCard address={defaultAddress} changePath={path('/enderecos')} />
        </div>
      )}
    </div>
  );
}
