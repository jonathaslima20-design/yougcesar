import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, X, Loader as Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOrders, type FetchOrdersFilters } from '@/lib/orderService';
import { buildPrintStoreInfo, fetchPrintCompanyInfo, type PrintStoreInfo } from '@/lib/orderPrint';
import OrderListPrintDocument, { type OrderListFilterLabels } from '@/components/orders/OrderListPrintDocument';
import { Button } from '@/components/ui/button';
import type { Order, OrderPaymentStatus, OrderStatus } from '@/types';

// Acima desse número a impressão não abre sozinha: o lojista confirma antes,
// porque a lista pode ocupar muitas folhas.
const CONFIRM_THRESHOLD = 300;
const BATCH_SIZE = 200;

const PAGE_CSS = '@page { size: A4; margin: 12mm; }';

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos os status',
  pending: 'Pendentes',
  confirmed: 'Confirmados',
  preparing: 'Em preparo',
  shipped: 'Enviados',
  delivered: 'Entregues',
  cancelled: 'Cancelados',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  all: 'Todos os tipos',
  whatsapp: 'WhatsApp',
  ecommerce: 'Pagamento Online',
};

const PAYMENT_LABELS: Record<string, string> = {
  all: 'Todos os pagamentos',
  pending: 'Pagamento pendente',
  approved: 'Pagamento aprovado',
  rejected: 'Pagamento recusado',
  refunded: 'Reembolsado',
  cancelled: 'Pagamento cancelado',
};

// Busca todos os pedidos que batem com os filtros, em lotes, porque
// fetchOrders devolve no máximo um lote por chamada.
async function fetchAllMatchingOrders(
  userId: string,
  filters: FetchOrdersFilters
): Promise<{ orders: Order[]; total: number }> {
  const orders: Order[] = [];
  let offset = 0;
  let total = 0;

  do {
    const { data, count } = await fetchOrders(userId, BATCH_SIZE, offset, filters);
    orders.push(...data);
    total = count;
    offset += BATCH_SIZE;
    if (data.length === 0) break;
  } while (offset < total);

  return { orders, total };
}

export default function OrderListPrintPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const statusParam = searchParams.get('status') ?? 'all';
  const orderTypeParam = searchParams.get('orderType') ?? 'all';
  const paymentParam = searchParams.get('paymentStatus') ?? 'all';
  const search = searchParams.get('search') ?? '';

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [total, setTotal] = useState(0);
  const [store, setStore] = useState<PrintStoreInfo | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [generatedAt] = useState(() => new Date());

  const filters = useMemo<FetchOrdersFilters>(() => {
    const f: FetchOrdersFilters = {};
    if (statusParam !== 'all') f.status = statusParam as OrderStatus;
    if (orderTypeParam !== 'all') f.orderType = orderTypeParam as 'whatsapp' | 'ecommerce';
    if (paymentParam !== 'all') f.paymentStatus = paymentParam as OrderPaymentStatus;
    if (search.trim()) f.search = search.trim();
    return f;
  }, [statusParam, orderTypeParam, paymentParam, search]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      const [{ orders: list, total: count }, company] = await Promise.all([
        fetchAllMatchingOrders(user.id, filters),
        fetchPrintCompanyInfo(user.id),
      ]);
      if (cancelled) return;
      setOrders(list);
      setTotal(count);
      setStore(buildPrintStoreInfo(user, company));
    })();

    return () => {
      cancelled = true;
    };
  }, [user, filters]);

  const needsConfirm = total > CONFIRM_THRESHOLD;

  const filterLabels: OrderListFilterLabels = {
    status: STATUS_LABELS[statusParam] ?? STATUS_LABELS.all,
    orderType: ORDER_TYPE_LABELS[orderTypeParam] ?? ORDER_TYPE_LABELS.all,
    paymentStatus: PAYMENT_LABELS[paymentParam] ?? PAYMENT_LABELS.all,
    search,
  };

  // Mesmo título usado pelo "Salvar como PDF" dos pedidos individuais.
  useEffect(() => {
    if (!orders) return;
    const previousTitle = document.title;
    document.title = `Relatório de vendas - ${generatedAt.toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
    return () => {
      document.title = previousTitle;
    };
  }, [orders, generatedAt]);

  // Abre o diálogo sozinho só quando a lista não precisa de confirmação.
  useEffect(() => {
    if (!orders || !store || needsConfirm || searchParams.get('print') !== '1') return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [orders, store, needsConfirm, searchParams]);

  const handlePrint = () => {
    setConfirmed(true);
    window.print();
  };

  if (!orders || !store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <style>{PAGE_CSS}</style>

      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => window.close()} className="gap-1.5">
          <X className="h-4 w-4" />
          Fechar
        </Button>
        <div className="flex items-center gap-3">
          {needsConfirm && !confirmed && (
            <span className="text-xs text-amber-600">Esta lista tem {total} pedidos e pode ocupar muitas folhas.</span>
          )}
          <Button size="sm" onClick={handlePrint} disabled={orders.length === 0} className="gap-1.5">
            <Printer className="h-4 w-4" />
            {needsConfirm && !confirmed ? `Imprimir ${total} pedidos` : 'Imprimir / Salvar PDF'}
          </Button>
        </div>
      </div>

      <div className="py-6 px-4 print:p-0">
        <div className="mx-auto max-w-[210mm] bg-white shadow-sm print:shadow-none">
          {orders.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">Nenhum pedido encontrado com os filtros atuais.</p>
          ) : (
            <OrderListPrintDocument orders={orders} store={store} filters={filterLabels} generatedAt={generatedAt} />
          )}
        </div>
      </div>
    </div>
  );
}
