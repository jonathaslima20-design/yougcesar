import { useEffect, useState } from 'react';
import { Navigate, useParams, useNavigate, Link } from 'react-router-dom';
import { Loader, Check, ArrowLeft, RotateCcw, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import { reorderItems } from '@/lib/buyerReorder';
import { getWhatsAppContactUrl } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

interface OrderDetailRow {
  id: string;
  store_owner_id: string;
  status: OrderStatus;
  payment_status: string;
  order_type: string;
  subtotal: number;
  delivery_fee: number | null;
  insurance_fee: number | null;
  discount_amount: number | null;
  total: number;
  created_at: string;
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip_code: string | null;
}

interface OrderItemRow {
  id: string;
  product_id: string;
  product_title: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  selected_color: string | null;
  selected_size: string | null;
  selected_flavor: string | null;
  selected_variant_label: string | null;
  subtotal: number;
}

interface StoreInfo {
  name: string;
  slug: string;
  whatsapp?: string;
  whatsapp_mode?: string;
  whatsapp_link?: string;
  country_code?: string;
}

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Recebido' },
  { status: 'confirmed', label: 'Confirmado' },
  { status: 'preparing', label: 'Preparando' },
  { status: 'shipped', label: 'Enviado' },
  { status: 'delivered', label: 'Entregue' },
];

const PAYMENT_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  not_applicable: { label: 'Sem pagamento online', variant: 'outline' },
  pending: { label: 'Pagamento pendente', variant: 'secondary' },
  approved: { label: 'Pagamento aprovado', variant: 'default' },
  rejected: { label: 'Pagamento recusado', variant: 'destructive' },
  refunded: { label: 'Reembolsado', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BuyerOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { customer, loading: authLoading } = useBuyerAuth();
  const { addToCart, clearCart } = useCart();
  const [order, setOrder] = useState<OrderDetailRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!customer || !orderId) return;

    (async () => {
      setLoading(true);
      const { data: orderRow } = await supabaseBuyer
        .from('orders')
        .select(
          'id, store_owner_id, status, payment_status, order_type, subtotal, delivery_fee, insurance_fee, discount_amount, total, created_at, shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_zip_code'
        )
        .eq('id', orderId)
        .eq('buyer_id', customer.id)
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
          .select('name, slug, whatsapp, whatsapp_mode, whatsapp_link, country_code')
          .eq('id', orderRow.store_owner_id)
          .maybeSingle(),
      ]);

      setItems(itemRows || []);
      setStore(storeRow);
      setLoading(false);
    })();
  }, [customer, orderId]);

  if (!authLoading && !customer) {
    return <Navigate to="/conta/entrar" state={{ from: `/conta/pedidos/${orderId}` }} replace />;
  }

  const handleReorder = async () => {
    if (!store?.slug || items.length === 0) return;
    setReordering(true);
    try {
      clearCart();
      const result = await reorderItems(items, addToCart);
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
      setReordering(false);
    }
  };

  const whatsappUrl = store?.whatsapp || store?.whatsapp_link
    ? getWhatsAppContactUrl(
        store,
        `Olá! Gostaria de falar sobre meu pedido #${(orderId || '').slice(0, 8)}.`
      )
    : null;

  const currentStepIndex = order ? STEPS.findIndex((s) => s.status === order.status) : -1;
  const hasAddress = order && (order.shipping_street || order.shipping_city);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/conta/pedidos">
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
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{store?.name || 'Pedido'}</span>
                  <Badge variant={(PAYMENT_STATUS_LABELS[order.payment_status] || PAYMENT_STATUS_LABELS.not_applicable).variant}>
                    {(PAYMENT_STATUS_LABELS[order.payment_status] || PAYMENT_STATUS_LABELS.not_applicable).label}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pedido feito em {new Date(order.created_at).toLocaleDateString('pt-BR')}
                </p>
              </CardHeader>
              <CardContent>
                {order.status === 'cancelled' ? (
                  <Badge variant="destructive">Pedido cancelado</Badge>
                ) : (
                  <div className="flex items-center justify-between">
                    {STEPS.map((step, index) => {
                      const isDone = index <= currentStepIndex;
                      return (
                        <div key={step.status} className="flex-1 flex flex-col items-center text-center">
                          <div className="flex items-center w-full">
                            <div
                              className={cn(
                                'h-full flex-1 border-t-2',
                                index === 0 ? 'border-transparent' : isDone ? 'border-primary' : 'border-border'
                              )}
                            />
                            <div
                              className={cn(
                                'h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2',
                                isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground'
                              )}
                            >
                              {isDone && <Check className="h-3.5 w-3.5" />}
                            </div>
                            <div
                              className={cn(
                                'h-full flex-1 border-t-2',
                                index === STEPS.length - 1 ? 'border-transparent' : isDone ? 'border-primary' : 'border-border'
                              )}
                            />
                          </div>
                          <span className={cn('text-[11px] mt-1.5', isDone ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Itens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {item.quantity}x {item.product_title}
                      </p>
                      {(item.selected_color || item.selected_size || item.selected_flavor || item.selected_variant_label) && (
                        <p className="text-xs text-muted-foreground">
                          {[item.selected_variant_label, item.selected_color, item.selected_size, item.selected_flavor]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <p className="font-medium shrink-0">{formatMoney(item.subtotal)}</p>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(order.subtotal)}</span>
                </div>
                {!!order.delivery_fee && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Entrega</span>
                    <span>{formatMoney(order.delivery_fee)}</span>
                  </div>
                )}
                {!!order.insurance_fee && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Seguro de frete</span>
                    <span>{formatMoney(order.insurance_fee)}</span>
                  </div>
                )}
                {!!order.discount_amount && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Desconto</span>
                    <span>-{formatMoney(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(order.total)}</span>
                </div>
              </CardContent>
            </Card>

            {hasAddress && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Endereço de entrega</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {order.shipping_street}, {order.shipping_number}
                    {order.shipping_complement ? ` - ${order.shipping_complement}` : ''}
                    <br />
                    {order.shipping_neighborhood ? `${order.shipping_neighborhood}, ` : ''}
                    {order.shipping_city} - {order.shipping_state}
                    <br />
                    CEP {order.shipping_zip_code}
                  </p>
                </CardContent>
              </Card>
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
    </div>
  );
}
