import { Separator } from '@/components/ui/separator';

export interface OrderItemRow {
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

export interface OrderTotals {
  subtotal: number;
  delivery_fee: number | null;
  delivery_is_quote?: boolean | null;
  insurance_fee: number | null;
  discount_amount: number | null;
  total: number;
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function OrderItemsSummary({ items, totals }: { items: OrderItemRow[]; totals: OrderTotals }) {
  return (
    <div className="space-y-3">
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
        <span>{formatMoney(totals.subtotal)}</span>
      </div>
      {totals.delivery_is_quote ? (
        <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
          <span>Entrega</span>
          <span>A combinar</span>
        </div>
      ) : !!totals.delivery_fee && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Entrega</span>
          <span>{formatMoney(totals.delivery_fee)}</span>
        </div>
      )}
      {!!totals.insurance_fee && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Seguro de frete</span>
          <span>{formatMoney(totals.insurance_fee)}</span>
        </div>
      )}
      {!!totals.discount_amount && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Desconto</span>
          <span>-{formatMoney(totals.discount_amount)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{formatMoney(totals.total)}</span>
      </div>
    </div>
  );
}
