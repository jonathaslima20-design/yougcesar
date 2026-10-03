import type { Order } from '@/types';
import {
  ORDER_STATUS_PRINT_LABELS,
  PAYMENT_STATUS_PRINT_LABELS,
  formatBRL,
  formatCnpj,
  formatPhone,
  formatPrintDate,
  formatPrintDateTime,
  shortOrderCode,
  type PrintStoreInfo,
} from '@/lib/orderPrint';

export interface OrderListFilterLabels {
  status: string;
  orderType: string;
  paymentStatus: string;
  search: string;
}

interface OrderListPrintDocumentProps {
  orders: Order[];
  store: PrintStoreInfo;
  filters: OrderListFilterLabels;
  generatedAt: Date;
}

const ORDER_TYPE_PRINT_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  ecommerce: 'Online',
};

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className="text-[15px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function OrderListPrintDocument({ orders, store, filters, generatedAt }: OrderListPrintDocumentProps) {
  // Pedidos cancelados não entram na receita, para o total bater com o que
  // de fato foi vendido.
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const revenue = activeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pending = orders.filter((o) => o.status === 'pending').length;
  const cancelled = orders.length - activeOrders.length;
  const itemsCount = activeOrders.reduce((sum, o) => sum + (o.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0), 0);

  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const periodStart = sorted[0]?.created_at;
  const periodEnd = sorted[sorted.length - 1]?.created_at;

  const storeLocation = [store.city, store.state].filter(Boolean).join(' - ');
  const storePhone = store.whatsapp ? formatPhone(store.countryCode, store.whatsapp) : null;

  const activeFilters = [
    filters.status !== 'Todos os status' && filters.status,
    filters.orderType !== 'Todos os tipos' && filters.orderType,
    filters.paymentStatus !== 'Todos os pagamentos' && filters.paymentStatus,
    filters.search && `Busca: "${filters.search}"`,
  ].filter(Boolean) as string[];

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white text-neutral-900 p-8 print:p-0 print:max-w-none font-sans">
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
        <div className="flex items-center gap-4 min-w-0">
          {store.logoUrl && <img src={store.logoUrl} alt="" className="h-14 w-14 rounded object-cover shrink-0" />}
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
          <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">Relatório de vendas</p>
          {periodStart && periodEnd && (
            <p className="text-[13px] font-semibold mt-0.5">
              {formatPrintDate(periodStart)}
              {formatPrintDate(periodStart) !== formatPrintDate(periodEnd) && ` a ${formatPrintDate(periodEnd)}`}
            </p>
          )}
          <p className="text-[11px] text-neutral-600 mt-0.5">Emitido em {formatPrintDateTime(generatedAt.toISOString())}</p>
        </div>
      </header>

      {activeFilters.length > 0 && (
        <p className="mt-3 text-[11px] text-neutral-600">
          <span className="font-semibold text-neutral-700">Filtros:</span> {activeFilters.join('  ·  ')}
        </p>
      )}

      <section className="mt-4 grid grid-cols-4 gap-4 rounded border border-neutral-300 p-4">
        <SummaryItem label="Pedidos" value={String(orders.length)} />
        <SummaryItem label="Receita" value={formatBRL(revenue)} />
        <SummaryItem label="Itens vendidos" value={String(itemsCount)} />
        <SummaryItem label="Pendentes / cancelados" value={`${pending} / ${cancelled}`} />
      </section>

      <table className="mt-5 w-full border-collapse text-[11px]">
        <thead className="table-header-group">
          <tr className="border-b border-neutral-400 text-left text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="py-1.5 pr-2 font-semibold">Data</th>
            <th className="py-1.5 px-2 font-semibold">Pedido</th>
            <th className="py-1.5 px-2 font-semibold">Cliente</th>
            <th className="py-1.5 px-2 font-semibold">Tipo</th>
            <th className="py-1.5 px-2 font-semibold">Status</th>
            <th className="py-1.5 px-2 font-semibold">Pagamento</th>
            <th className="py-1.5 px-2 font-semibold text-center">Itens</th>
            <th className="py-1.5 pl-2 font-semibold text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => (
            <tr key={o.id} className="break-inside-avoid border-b border-neutral-200">
              <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums">{formatPrintDate(o.created_at)}</td>
              <td className="py-1.5 px-2 font-mono">#{shortOrderCode(o.id)}</td>
              <td className="py-1.5 px-2">{o.customer_name}</td>
              <td className="py-1.5 px-2">{ORDER_TYPE_PRINT_LABELS[o.order_type] ?? o.order_type}</td>
              <td className={`py-1.5 px-2 ${o.status === 'cancelled' ? 'line-through text-neutral-500' : ''}`}>
                {ORDER_STATUS_PRINT_LABELS[o.status]}
              </td>
              <td className="py-1.5 px-2">
                {o.order_type === 'ecommerce'
                  ? PAYMENT_STATUS_PRINT_LABELS[o.payment_status ?? 'not_applicable'] ?? o.payment_status
                  : o.payment_method || '—'}
              </td>
              <td className="py-1.5 px-2 text-center tabular-nums">
                {o.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums font-medium">{formatBRL(o.total)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-neutral-900 font-bold">
            <td colSpan={7} className="py-2 pr-2 text-right text-[11px]">Receita (sem cancelados)</td>
            <td className="py-2 pl-2 text-right tabular-nums text-[13px]">{formatBRL(revenue)}</td>
          </tr>
        </tbody>
      </table>

      <footer className="mt-10 border-t border-neutral-300 pt-2 flex justify-between text-[10px] text-neutral-500">
        <span>Documento não fiscal. Não substitui nota fiscal.</span>
        <span>Gerado em {formatPrintDateTime(generatedAt.toISOString())}</span>
      </footer>
    </article>
  );
}
