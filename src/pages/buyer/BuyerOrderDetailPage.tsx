import { useEffect, useState } from 'react';
import { Navigate, useParams, useNavigate, Link } from 'react-router-dom';
import { Loader, ArrowLeft, RotateCcw, MessageCircle, Truck, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useBuyerStore } from '@/contexts/BuyerStoreContext';
import PaymentStatusBadge from '@/components/buyer/BuyerPaymentStatusBadge';
import { SectionTitle } from '@/components/buyer/overview/BuyerOverviewCards';
import { useReorderDestination } from '@/hooks/useReorderDestination';
import { useCart } from '@/contexts/CartContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { reorderItems } from '@/lib/buyerReorder';
import { getWhatsAppContactUrl } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderStatusTimeline } from '@/components/buyer/OrderStatusTimeline';
import { OrderItemsSummary, type OrderItemRow } from '@/components/buyer/OrderItemsSummary';
import { OrderShippingAddress, hasShippingAddress } from '@/components/buyer/OrderShippingAddress';
import { OrderPickupInfo } from '@/components/buyer/OrderPickupInfo';
import type { OrderStatus } from '@/types';

interface OrderDetailRow {
  id: string;
  store_owner_id: string;
  status: OrderStatus;
  payment_status: string;
  order_type: string;
  subtotal: number;
  delivery_fee: number | null;
  delivery_is_quote: boolean | null;
  delivery_option: string | null;
  delivery_scope: string | null;
  pickup_instructions: string | null;
  insurance_fee: number | null;
  discount_amount: number | null;
  cashback_used: number | null;
  total: number;
  created_at: string;
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip_code: string | null;
  carrier: string | null;
  tracking_code: string | null;
}

interface StoreInfo {
  name: string;
  slug: string;
  whatsapp?: string;
  whatsapp_mode?: string;
  whatsapp_link?: string;
  country_code?: string;
  city?: string | null;
  state?: string | null;
}

export default function BuyerOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { customer, loading: authLoading } = useBuyerAuth();
  const { store: buyerStore, path, loginPath } = useBuyerStore();
  const { destination, isCheckout } = useReorderDestination(buyerStore);
  const { addToCart, clearCart } = useCart();
  const [order, setOrder] = useState<OrderDetailRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [trackingCopied, setTrackingCopied] = useState(false);

  useEffect(() => {
    if (!customer || !orderId || !buyerStore) return;

    (async () => {
      setLoading(true);
      const { data: orderRow } = await supabaseBuyer
        .from('orders')
        .select(
          'id, store_owner_id, status, payment_status, order_type, subtotal, delivery_fee, delivery_is_quote, delivery_option, delivery_scope, pickup_instructions, insurance_fee, discount_amount, cashback_used, total, created_at, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_zip_code, carrier, tracking_code'
        )
        .eq('id', orderId)
        .eq('buyer_id', customer.id)
        .eq('store_owner_id', buyerStore.id)
        .maybeSingle();

      if (!orderRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setOrder(orderRow);

      const [{ data: itemRows }, { data: storeRow }] = await Promise.all([
        supabaseBuyer
          .from('order_items')
          .select(
            'id, product_id, product_title, product_image_url, quantity, unit_price, selected_color, selected_size, selected_flavor, selected_variant_label, subtotal'
          )
          .eq('order_id', orderId),
        supabaseBuyer
          .from('users')
          .select('name, slug, whatsapp, whatsapp_mode, whatsapp_link, country_code, city, state')
          .eq('id', orderRow.store_owner_id)
          .maybeSingle(),
      ]);

      setItems(itemRows || []);
      setStore(storeRow);
      setLoading(false);
    })();
  }, [customer, orderId, buyerStore]);

  if (!authLoading && !customer) {
    return <Navigate to={loginPath} state={{ from: path(`/pedidos/${orderId}`) }} replace />;
  }

  const handleReorder = async () => {
    if (!destination || items.length === 0) return;
    setReordering(true);
    try {
      clearCart();
      const result = await reorderItems(items, addToCart);
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
      setReordering(false);
    }
  };

  const whatsappUrl = store?.whatsapp || store?.whatsapp_link
    ? getWhatsAppContactUrl(
        store,
        `Olá! Gostaria de falar sobre meu pedido #${(orderId || '').slice(0, 8)}.`
      )
    : null;

  const isPickup = order?.delivery_scope === 'pickup';
  const hasAddress = order && !isPickup && hasShippingAddress(order);

  const handleCopyTracking = () => {
    if (!order?.tracking_code) return;
    navigator.clipboard.writeText(order.tracking_code);
    setTrackingCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setTrackingCopied(false), 2000);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to={path('/pedidos')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Meus Pedidos
        </Link>
      </Button>

      {authLoading || loading ? (
          <div className="flex justify-center py-16">
            <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notFound || !order ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              Pedido não encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-5 pb-5 px-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-lg font-semibold">Pedido #{order.id.slice(0, 8)}</h1>
                    <p className="text-xs text-muted-foreground">
                      Feito em {new Date(order.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <PaymentStatusBadge status={order.payment_status} className="shrink-0" />
                </div>
                <OrderStatusTimeline status={order.status} />
              </CardContent>
            </Card>

            <div>
              <SectionTitle>Itens</SectionTitle>
              <Card>
                <CardContent className="pt-5">
                  <OrderItemsSummary items={items} totals={order} />
                </CardContent>
              </Card>
            </div>

            {order.tracking_code && (
              <div>
                <SectionTitle>Rastreio</SectionTitle>
                <Card>
                  <CardContent className="pt-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Truck className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        {order.carrier && <p className="text-xs text-muted-foreground">{order.carrier}</p>}
                        <p className="font-mono font-medium truncate">{order.tracking_code}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyTracking} className="shrink-0" aria-label="Copiar código de rastreio">
                      {trackingCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {isPickup && (
              <div>
                <SectionTitle>Retirada na loja</SectionTitle>
                <Card>
                  <CardContent className="pt-5">
                    <OrderPickupInfo order={order} store={store || undefined} />
                  </CardContent>
                </Card>
              </div>
            )}

            {hasAddress && (
              <div>
                <SectionTitle>Endereço de entrega</SectionTitle>
                <Card>
                  <CardContent className="pt-5">
                    <OrderShippingAddress address={order} />
                  </CardContent>
                </Card>
              </div>
            )}

            {order.payment_status === 'pending' && store?.slug && (
              <Button asChild className="w-full">
                <Link to={`/${store.slug}/pedido/${order.id}/pagamento`}>Continuar pagamento</Link>
              </Button>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {whatsappUrl && (
                <Button variant="outline" asChild className="flex-1">
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Falar com o vendedor
                  </a>
                </Button>
              )}
              {store?.slug && (
                <Button variant="outline" onClick={handleReorder} disabled={reordering} className="flex-1">
                  {reordering ? (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Repetir pedido
                </Button>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
