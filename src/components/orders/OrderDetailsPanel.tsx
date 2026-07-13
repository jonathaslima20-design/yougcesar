import { useState, useEffect } from 'react';
import { X, MessageCircle, Package, Clock, ShoppingCart, MapPin, Ticket, Wallet, Truck, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import OrderStatusBadge from './OrderStatusBadge';
import InventoryDeductionDialog from './InventoryDeductionDialog';
import type { InventoryItemInfo } from './InventoryDeductionDialog';
import { updateOrderStatus, fetchOrderInventoryInfo } from '@/lib/orderService';
import { deductStockForOrder, restoreStockForOrder } from '@/lib/stockUtils';
import { useInventoryEnabled } from '@/hooks/useInventoryEnabled';
import { generateWhatsAppUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Order, OrderStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface OrderDetailsPanelProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: (orderId: string, newStatus: OrderStatus) => void;
}

const STATUS_TRANSITIONS: Record<string, { label: string; next: OrderStatus }[]> = {
  pending: [
    { label: 'Confirmar Pedido', next: 'confirmed' },
    { label: 'Cancelar', next: 'cancelled' },
  ],
  confirmed: [
    { label: 'Marcar como Preparando', next: 'preparing' },
    { label: 'Cancelar', next: 'cancelled' },
  ],
  preparing: [
    { label: 'Marcar como Enviado', next: 'shipped' },
  ],
  shipped: [
    { label: 'Marcar como Entregue', next: 'delivered' },
  ],
  delivered: [],
  cancelled: [],
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function OrderDetailsPanel({
  order,
  open,
  onOpenChange,
  onStatusUpdate,
}: OrderDetailsPanelProps) {
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const { inventoryEnabled, autoDeductStock } = useInventoryEnabled();
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventoryDialogMode, setInventoryDialogMode] = useState<'deduct' | 'restore'>('deduct');
  const [inventoryItems, setInventoryItems] = useState<InventoryItemInfo[]>([]);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [colorImageMap, setColorImageMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!order) return;
    const itemsWithColor = (order.order_items || []).filter(
      (item) => item.product_id && item.selected_color
    );
    if (itemsWithColor.length === 0) {
      setColorImageMap({});
      return;
    }

    const fetchColorImages = async () => {
      const productIds = [...new Set(itemsWithColor.map((i) => i.product_id))];
      const { data } = await supabase
        .from('product_images')
        .select('product_id, url, associated_color')
        .in('product_id', productIds)
        .not('associated_color', 'is', null);

      if (!data) return;

      const map: Record<string, string> = {};
      for (const item of itemsWithColor) {
        const key = `${item.id}`;
        const match = data.find(
          (img) =>
            img.product_id === item.product_id &&
            img.associated_color === item.selected_color
        );
        if (match) map[key] = match.url;
      }
      setColorImageMap(map);
    };

    fetchColorImages();
  }, [order?.id]);

  if (!order) return null;

  const transitions = STATUS_TRANSITIONS[order.status] || [];
  const items = order.order_items || [];

  const executeStatusChange = async (newStatus: OrderStatus) => {
    setUpdating(true);
    const success = await updateOrderStatus(order.id, newStatus);
    if (success) {
      const statusLabels: Record<string, string> = {
        pending: 'pendente', confirmed: 'confirmado', preparing: 'em preparo',
        shipped: 'enviado', delivered: 'entregue', cancelled: 'cancelado',
      };
      logActivity('order.status_change', `Atualizou pedido de ${order.customer_name} para "${statusLabels[newStatus] || newStatus}"`, 'order', order.id);
      onStatusUpdate(order.id, newStatus);
      toast.success(
        newStatus === 'cancelled'
          ? 'Pedido cancelado'
          : 'Status atualizado'
      );
    } else {
      toast.error('Erro ao atualizar status');
    }
    setUpdating(false);
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!inventoryEnabled) {
      await executeStatusChange(newStatus);
      return;
    }

    if (newStatus === 'confirmed' && !autoDeductStock) {
      setUpdating(true);
      const invItems = await fetchOrderInventoryInfo(order.id);
      setUpdating(false);

      const trackedItems = invItems.filter((i) => i.track_inventory);
      if (trackedItems.length > 0) {
        setInventoryItems(invItems);
        setInventoryDialogMode('deduct');
        setPendingStatus(newStatus);
        setInventoryDialogOpen(true);
        return;
      }
    }

    if (newStatus === 'cancelled' && order.inventory_deducted) {
      setUpdating(true);
      const invItems = await fetchOrderInventoryInfo(order.id);
      setUpdating(false);

      const trackedItems = invItems.filter((i) => i.track_inventory);
      if (trackedItems.length > 0) {
        setInventoryItems(invItems);
        setInventoryDialogMode('restore');
        setPendingStatus(newStatus);
        setInventoryDialogOpen(true);
        return;
      }
    }

    await executeStatusChange(newStatus);
  };

  const handleInventoryConfirm = async () => {
    if (!pendingStatus || !user?.id) return;

    if (inventoryDialogMode === 'deduct') {
      const deductionItems = inventoryItems
        .filter((i) => i.track_inventory)
        .map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          selected_color: i.selected_color,
          selected_size: i.selected_size,
          selected_flavor: i.selected_flavor,
          selected_variant_label: i.selected_variant_label,
        }));

      await deductStockForOrder(order.id, user.id, deductionItems);
    } else {
      const restoreItems = inventoryItems
        .filter((i) => i.track_inventory)
        .map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          selected_color: i.selected_color,
          selected_size: i.selected_size,
          selected_flavor: i.selected_flavor,
          selected_variant_label: i.selected_variant_label,
        }));

      await restoreStockForOrder(order.id, restoreItems);
    }

    await executeStatusChange(pendingStatus);
    setPendingStatus(null);
  };

  const handleInventorySkip = async () => {
    if (pendingStatus) {
      await executeStatusChange(pendingStatus);
      setPendingStatus(null);
    }
  };

  const whatsappUrl = order.customer_whatsapp
    ? generateWhatsAppUrl(
        order.customer_whatsapp,
        `Ola ${order.customer_name}, sobre o seu pedido...`,
        order.customer_country_code || '55'
      )
    : '';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">Detalhes do Pedido</SheetTitle>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <OrderStatusBadge status={order.status} />
              <Badge variant="outline" className="text-xs">
                {order.source === 'cart' ? 'Carrinho' : 'Pagina do Produto'}
              </Badge>
              {order.inventory_deducted && (
                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                  Estoque reduzido
                </Badge>
              )}
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Customer Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cliente</h4>
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  +{order.customer_country_code} {order.customer_whatsapp}
                </p>
                {whatsappUrl && (
                  <Button variant="outline" size="sm" className="mt-2 gap-1.5" asChild>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Falar no WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Itens ({items.length})
              </h4>
              <div className="space-y-3">
                {items.map((item) => {
                  const productUrl = user?.slug
                    ? `/${user.slug}/produtos/${item.product_id}${item.selected_color ? `?cor=${encodeURIComponent(item.selected_color)}` : ''}`
                    : null;

                  return (
                  <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                    <a
                      href={productUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0 ${productUrl ? 'cursor-pointer ring-offset-2 hover:ring-2 hover:ring-primary/50 transition-all' : ''}`}
                      onClick={(e) => { if (!productUrl) e.preventDefault(); }}
                    >
                      {(colorImageMap[item.id] || item.product_image_url) ? (
                        <img
                          src={colorImageMap[item.id] || item.product_image_url}
                          alt={item.product_title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        {productUrl ? (
                          <a
                            href={productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium line-clamp-1 hover:text-primary hover:underline transition-colors"
                          >
                            {item.product_title}
                          </a>
                        ) : (
                          <p className="text-sm font-medium line-clamp-1">{item.product_title}</p>
                        )}
                        {productUrl && item.selected_color && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.selected_color && (
                          <span className="text-xs text-muted-foreground">Cor: {item.selected_color}</span>
                        )}
                        {item.selected_size && (
                          <span className="text-xs text-muted-foreground">Tam: {item.selected_size}</span>
                        )}
                        {item.selected_flavor && (
                          <span className="text-xs text-muted-foreground">Sabor: {item.selected_flavor}</span>
                        )}
                        {item.selected_variant_label && (
                          <span className="text-xs text-muted-foreground">{item.selected_variant_label}</span>
                        )}
                      </div>
                      {item.item_notes && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic">{item.item_notes}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {item.quantity}x {formatCurrency(item.unit_price)}
                        </span>
                        <span className="text-sm font-semibold">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Price Breakdown */}
            {(order.coupon_code || order.payment_method || order.delivery_option) && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="text-sm">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.coupon_code && (
                    <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                      <span className="text-sm flex items-center gap-1.5">
                        <Ticket className="h-3.5 w-3.5" />
                        Cupom {order.coupon_code}
                      </span>
                      <span className="text-sm font-medium">-{formatCurrency(order.discount_amount || 0)}</span>
                    </div>
                  )}
                  {order.payment_method && order.payment_method_discount && order.payment_method_discount > 0 && (
                    <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                      <span className="text-sm flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5" />
                        Desc. {order.payment_method}
                      </span>
                      <span className="text-sm font-medium">-{formatCurrency(order.payment_method_discount)}</span>
                    </div>
                  )}
                  {order.delivery_option && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" />
                        Entrega: {order.delivery_option}
                      </span>
                      <span className="text-sm font-medium">
                        {order.delivery_fee && order.delivery_fee > 0
                          ? `+${formatCurrency(order.delivery_fee)}`
                          : 'Gratis'
                        }
                      </span>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Payment Method (when no price breakdown section) */}
            {order.payment_method && !order.coupon_code && !order.delivery_option && !(order.payment_method_discount && order.payment_method_discount > 0) && (
              <>
                <div className="flex items-center gap-1.5 text-sm">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Pagamento:</span>
                  <span className="font-medium">{order.payment_method}</span>
                </div>
                <Separator />
              </>
            )}

            {/* Order Total */}
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(order.total)}
              </span>
            </div>

            {/* Payment Method Label (shown under total when breakdown section already present) */}
            {order.payment_method && (order.coupon_code || order.delivery_option || (order.payment_method_discount && order.payment_method_discount > 0)) && (
              <div className="flex items-center gap-1.5 text-sm">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Pagamento:</span>
                <span className="font-medium">{order.payment_method}</span>
              </div>
            )}

            {/* Order Info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'as' HH:mm", { locale: ptBR })}
              </div>
            </div>

            <Separator />

            {/* Status Actions */}
            {transitions.length > 0 && (
              <div className="space-y-2">
                {transitions.map((t) => (
                  <Button
                    key={t.next}
                    variant={t.next === 'cancelled' ? 'destructive' : 'default'}
                    className="w-full"
                    disabled={updating}
                    onClick={() => handleStatusChange(t.next)}
                  >
                    {updating ? 'Atualizando...' : t.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <InventoryDeductionDialog
        open={inventoryDialogOpen}
        onOpenChange={setInventoryDialogOpen}
        mode={inventoryDialogMode}
        items={inventoryItems}
        onConfirm={handleInventoryConfirm}
        onSkip={handleInventorySkip}
      />
    </>
  );
}
