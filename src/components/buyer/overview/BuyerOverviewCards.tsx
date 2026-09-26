import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Package, Truck, Wallet, ArrowRight, CreditCard, MapPin, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusTimeline } from '@/components/buyer/OrderStatusTimeline';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import { Badge } from '@/components/ui/badge';
import type { CustomerAddress } from '@/lib/customerAddressService';
import type { BuyAgainItem } from '@/hooks/useBuyAgainItems';
import type { CustomerCoupon } from '@/hooks/useCustomerCoupons';
import type { OrderStatus } from '@/types';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Quiet section heading: the content is the protagonist, not the label.
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (value: string, message: string) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    toast.success(message);
    setTimeout(() => setCopied((current) => (current === value ? null : current)), 2000);
  };
  return { copied, copy };
}

export interface ActiveOrder {
  id: string;
  status: OrderStatus;
  payment_status: string;
  total: number;
  created_at: string;
  delivery_scope: string | null;
  carrier: string | null;
  tracking_code: string | null;
}

// The one thing a buyer most often opens the account for: "where is my order?".
export function ActiveOrderCard({
  order,
  storeSlug,
  orderPath,
}: {
  order: ActiveOrder;
  storeSlug: string;
  orderPath: string;
}) {
  const { copied, copy } = useCopy();
  const awaitingPayment = order.payment_status === 'pending';
  const showTracking = order.delivery_scope !== 'pickup' && !!order.tracking_code;

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-5 pb-5 px-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5" />
              Pedido em andamento
            </p>
            <p className="font-semibold">#{order.id.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <p className="font-semibold shrink-0">{formatMoney(order.total)}</p>
        </div>

        <OrderStatusTimeline status={order.status} />

        {awaitingPayment && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-amber-500/10 px-3 py-2.5">
            <p className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
              Aguardando o pagamento
            </p>
            <Button size="sm" asChild className="shrink-0">
              <Link to={`/${storeSlug}/pedido/${order.id}/pagamento`}>Pagar agora</Link>
            </Button>
          </div>
        )}

        {showTracking && (
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{order.carrier || 'Código de rastreio'}</p>
                <p className="font-mono text-sm font-medium truncate">{order.tracking_code}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => copy(order.tracking_code!, 'Código copiado!')}
            >
              {copied === order.tracking_code ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}

        <Link to={orderPath} className="text-xs text-primary hover:underline inline-flex items-center gap-1 py-2 -my-2">
          Ver detalhes do pedido <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function CashbackCard({
  balance,
  ratePercent,
  loading,
  cashbackPath,
}: {
  balance: number;
  ratePercent: number;
  loading: boolean;
  cashbackPath: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5 px-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
            <Wallet className="h-3.5 w-3.5" />
            Seu cashback
          </p>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-3xl font-bold truncate">{formatMoney(balance)}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {balance > 0
              ? 'Use como desconto na sua próxima compra.'
              : ratePercent > 0
                ? `Ganhe ${ratePercent}% de volta nas suas próximas compras pagas online.`
                : 'Acumule saldo nas suas compras.'}
          </p>
        </div>
        <Link to={cashbackPath} className="text-xs text-primary hover:underline shrink-0 inline-flex items-center gap-1 py-2 -my-2">
          Extrato <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function describeCoupon(coupon: CustomerCoupon): { headline: string; details: string[] } {
  const headline =
    coupon.discount_type === 'percentage'
      ? `${Number(coupon.discount_value)}% OFF`
      : `${formatMoney(Number(coupon.discount_value))} OFF`;

  const details: string[] = [];
  if (coupon.min_order_value > 0) details.push(`em pedidos a partir de ${formatMoney(Number(coupon.min_order_value))}`);
  if (coupon.applies_to !== 'all_products') details.push('em produtos selecionados');
  if (coupon.valid_until) details.push(`até ${new Date(coupon.valid_until).toLocaleDateString('pt-BR')}`);
  return { headline, details };
}

// Only coupons the merchant opted in to show (see list_customer_visible_coupons).
export function OffersCard({ coupons }: { coupons: CustomerCoupon[] }) {
  const { copied, copy } = useCopy();
  if (coupons.length === 0) return null;

  return (
    <div>
      <SectionTitle>Ofertas para você</SectionTitle>
      <div className="space-y-2">
        {coupons.map((coupon) => {
          const { headline, details } = describeCoupon(coupon);
          return (
            <div key={coupon.id} className="flex items-center justify-between gap-3 border border-dashed border-primary/40 rounded-lg p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{headline}</p>
                {details.length > 0 && (
                  <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 font-mono gap-1.5"
                onClick={() => copy(coupon.code, 'Cupom copiado!')}
              >
                {copied === coupon.code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {coupon.code}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface RecentOrderRow {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
}

export function RecentOrderRowCard({
  order,
  href,
  thumb,
}: {
  order: RecentOrderRow;
  href: string;
  thumb?: { image: string | null; itemCount: number };
}) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 border border-border bg-card rounded-xl p-3 shadow-sm hover:bg-muted/40 transition-colors"
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
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">Pedido #{order.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
        <div className="mt-1">
          <OrderStatusBadge status={order.status} colorful />
        </div>
      </div>
      <p className="text-base font-bold shrink-0">{formatMoney(order.total)}</p>
    </Link>
  );
}

export function BuyAgainCard({
  item,
  busy,
  onBuy,
}: {
  item: BuyAgainItem;
  busy: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="snap-start flex flex-col gap-2.5 border border-border bg-card rounded-xl p-3 w-40 shrink-0 shadow-sm">
      <div className="w-full aspect-square bg-white rounded-lg overflow-hidden border border-border/60">
        <img
          src={item.product_image_url || FALLBACK_IMAGE}
          alt={item.product_title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" title={item.product_title}>
          {item.product_title}
        </p>
        {item.unit_price != null && (
          <p className="text-xs text-muted-foreground">Pago {formatMoney(item.unit_price)}</p>
        )}
      </div>
      <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={onBuy}>
        {busy ? <Loader className="h-3 w-3 animate-spin" /> : 'Comprar de novo'}
      </Button>
    </div>
  );
}

export function DefaultAddressCard({ address, changePath }: { address: CustomerAddress; changePath: string }) {
  // "Endereço" is the generic default nickname — no point repeating it as a title.
  const hasNickname = address.label.trim().toLowerCase() !== 'endereço';
  return (
    <Card>
      <CardContent className="py-4 px-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div className="text-sm min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">
              {hasNickname ? address.label : `${address.street}, ${address.number}`}
            </p>
            {address.is_default && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                Padrão
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {hasNickname ? `${address.street}, ${address.number} — ` : ''}
            {address.neighborhood ? `${address.neighborhood}, ` : ''}
            {address.city}/{address.state}
          </p>
        </div>
        <Link to={changePath} className="text-xs text-primary hover:underline shrink-0 py-2 -my-2">
          Alterar
        </Link>
      </CardContent>
    </Card>
  );
}
