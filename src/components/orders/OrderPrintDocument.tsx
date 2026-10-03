import type { Order } from '@/types';
import {
  DELIVERY_SCOPE_PRINT_LABELS,
  ORDER_STATUS_PRINT_LABELS,
  PAYMENT_STATUS_PRINT_LABELS,
  formatBRL,
  formatCnpj,
  formatPhone,
  formatPrintDateTime,
  maskCpf,
  shortOrderCode,
  type OrderPaymentRow,
  type PrintStoreInfo,
} from '@/lib/orderPrint';

interface OrderPrintDocumentProps {
  order: Order;
  store: PrintStoreInfo;
  payments: OrderPaymentRow[];
  generatedAt: Date;
}

const PAYMENT_ATTEMPT_PRINT_LABELS: Record<string, string> = {
  approved: 'Aprovado',
  pending: 'Pendente',
  in_process: 'Em análise',
  rejected: 'Recusado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};

const MAP_LINE_PREFIX = 'Ver no mapa: ';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 border-b border-neutral-300 pb-1 mb-2">
      {children}
    </h2>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="text-[12px] leading-snug">
      <span className="text-neutral-500">{label}: </span>
      <span className="text-neutral-900">{value}</span>
    </div>
  );
}

export default function OrderPrintDocument({ order, store, payments, generatedAt }: OrderPrintDocumentProps) {
  const isEcommerce = order.order_type === 'ecommerce';
  const isPickup = order.delivery_scope === 'pickup';
  const items = order.order_items ?? [];
  const hasShippingAddress = !isPickup && !!(order.shipping_street || order.shipping_city);
  const storeLocation = [store.city, store.state].filter(Boolean).join(' - ');
  const storePhone = store.whatsapp ? formatPhone(store.countryCode, store.whatsapp) : null;
  const pickupLines = (order.pickup_instructions || '').split('\n').filter(Boolean);

  const deliveryValue = order.delivery_is_quote
    ? 'A combinar'
    : order.delivery_fee && order.delivery_fee > 0
      ? formatBRL(order.delivery_fee)
      : 'Grátis';

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white text-neutral-900 p-8 print:p-0 print:max-w-none font-sans">
      {/* Cabeçalho */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
        <div className="flex items-center gap-4 min-w-0">
          {store.logoUrl && (
            <img src={store.logoUrl} alt="" className="h-14 w-14 rounded object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight truncate">{store.name}</p>
            {store.companyName && <p className="text-[12px] text-neutral-700">{store.companyName}</p>}
            {store.cnpj && <p className="text-[12px] text-neutral-700">CNPJ {formatCnpj(store.cnpj)}</p>}
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {[storeLocation, storePhone].filter(Boolean).join('  ·  ')}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">Pedido</p>
          <p className="text-xl font-bold font-mono">#{shortOrderCode(order.id)}</p>
          <p className="text-[12px] text-neutral-700 mt-0.5">{formatPrintDateTime(order.created_at)}</p>
          <p className="text-[12px] font-semibold mt-0.5">
            {ORDER_STATUS_PRINT_LABELS[order.status]}
            {isEcommerce && order.payment_status && (
              <span className="font-normal text-neutral-600">
                {' '}· Pagamento {PAYMENT_STATUS_PRINT_LABELS[order.payment_status] ?? order.payment_status}
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Cliente e entrega */}
      <section className="grid grid-cols-2 gap-6 mt-5">
        <div>
          <SectionTitle>Cliente</SectionTitle>
          <div className="space-y-1">
            <p className="text-[13px] font-semibold">{order.customer_name}</p>
            <Field label="WhatsApp" value={formatPhone(order.customer_country_code, order.customer_whatsapp)} />
            <Field label="CPF" value={order.customer_cpf ? maskCpf(order.customer_cpf) : null} />
          </div>
        </div>

        <div>
          <SectionTitle>{isPickup ? 'Retirada' : 'Entrega'}</SectionTitle>
          <div className="space-y-1">
            <Field label="Forma" value={order.delivery_option ?? (order.delivery_scope ? DELIVERY_SCOPE_PRINT_LABELS[order.delivery_scope] : null)} />
            {isPickup && storeLocation && <Field label="Local" value={storeLocation} />}
            {isPickup &&
              pickupLines.map((line, i) =>
                line.startsWith(MAP_LINE_PREFIX) ? (
                  <p key={i} className="text-[12px] break-all text-neutral-700">Mapa: {line.slice(MAP_LINE_PREFIX.length)}</p>
                ) : (
                  <p key={i} className="text-[12px] text-neutral-700 whitespace-pre-line">{line}</p>
                )
              )}
            {hasShippingAddress && (
              <p className="text-[12px] leading-snug text-neutral-800">
                {order.shipping_street}, {order.shipping_number}
                {order.shipping_complement ? ` - ${order.shipping_complement}` : ''}
                <br />
                {order.shipping_neighborhood ? `${order.shipping_neighborhood}, ` : ''}
                {order.shipping_city} - {order.shipping_state}
                <br />
                CEP {order.shipping_zip_code}
              </p>
            )}
            <Field label="Transportadora" value={order.carrier} />
            <Field label="Rastreio" value={order.tracking_code} />
          </div>
        </div>
      </section>

      {/* Itens */}
      <section className="mt-6">
        <SectionTitle>Itens ({items.length})</SectionTitle>
        <table className="w-full border-collapse text-[12px]">
          <thead className="table-header-group">
            <tr className="border-b border-neutral-400 text-left text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="py-1.5 pr-2 font-semibold">Produto</th>
              <th className="py-1.5 px-2 font-semibold text-center w-14">Qtd</th>
              <th className="py-1.5 px-2 font-semibold text-right w-24">Unitário</th>
              <th className="py-1.5 pl-2 font-semibold text-right w-24">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const variant = [item.selected_color, item.selected_size, item.selected_flavor, item.selected_variant_label]
                .filter(Boolean)
                .join(' / ');
              return (
                <tr key={item.id} className="break-inside-avoid border-b border-neutral-200 align-top">
                  <td className="py-2 pr-2">
                    <p className="font-medium text-neutral-900">{item.product_title}</p>
                    {variant && <p className="text-[11px] text-neutral-600">{variant}</p>}
                    {item.item_notes && <p className="text-[11px] italic text-neutral-600">Obs.: {item.item_notes}</p>}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums">{item.quantity}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatBRL(item.unit_price)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums font-medium">{formatBRL(item.subtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Totais */}
      <section className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-[12px] tabular-nums">
          <div className="flex justify-between">
            <span className="text-neutral-600">Subtotal</span>
            <span>{formatBRL(order.subtotal)}</span>
          </div>
          {order.coupon_code && (
            <div className="flex justify-between">
              <span className="text-neutral-600">Cupom {order.coupon_code}</span>
              <span>-{formatBRL(order.discount_amount)}</span>
            </div>
          )}
          {!!order.payment_method_discount && order.payment_method_discount > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-600">Desconto {order.payment_method}</span>
              <span>-{formatBRL(order.payment_method_discount)}</span>
            </div>
          )}
          {!isPickup && (order.delivery_option || order.delivery_fee) && (
            <div className="flex justify-between">
              <span className="text-neutral-600">Entrega</span>
              <span>{deliveryValue}</span>
            </div>
          )}
          {!!order.insurance_fee && order.insurance_fee > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-600">Seguro de frete</span>
              <span>{formatBRL(order.insurance_fee)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline border-t-2 border-neutral-900 pt-2 mt-2">
            <span className="text-[13px] font-bold">Total</span>
            <span className="text-[16px] font-bold">{formatBRL(order.total)}</span>
          </div>
          {order.payment_method && (
            <p className="text-right text-[11px] text-neutral-600 pt-1">Pagamento: {order.payment_method}</p>
          )}
        </div>
      </section>

      {/* Pagamentos online */}
      {isEcommerce && payments.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <SectionTitle>Histórico de pagamento</SectionTitle>
          <table className="w-full border-collapse text-[11px]">
            <thead className="table-header-group">
              <tr className="border-b border-neutral-300 text-left text-neutral-500">
                <th className="py-1 pr-2 font-semibold">Data</th>
                <th className="py-1 px-2 font-semibold">Forma</th>
                <th className="py-1 px-2 font-semibold text-right">Valor</th>
                <th className="py-1 pl-2 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="break-inside-avoid border-b border-neutral-100">
                  <td className="py-1 pr-2">{formatPrintDateTime(p.created_at)}</td>
                  <td className="py-1 px-2">{p.payment_method === 'pix' ? 'Pix' : `Cartão final ${p.card_last4 ?? '----'}`}</td>
                  <td className="py-1 px-2 text-right tabular-nums">{formatBRL(p.amount_cents / 100)}</td>
                  <td className="py-1 pl-2">{PAYMENT_ATTEMPT_PRINT_LABELS[p.status] ?? p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Observações */}
      {order.notes && (
        <section className="mt-6 break-inside-avoid">
          <SectionTitle>Observações</SectionTitle>
          <p className="text-[12px] whitespace-pre-line text-neutral-800">{order.notes}</p>
        </section>
      )}

      {/* Rodapé */}
      <footer className="mt-10 border-t border-neutral-300 pt-2 flex justify-between text-[10px] text-neutral-500">
        <span>Documento não fiscal. Não substitui nota fiscal.</span>
        <span>Gerado em {formatPrintDateTime(generatedAt.toISOString())}</span>
      </footer>
    </article>
  );
}
