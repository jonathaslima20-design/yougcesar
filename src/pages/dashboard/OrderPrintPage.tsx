import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, X, Loader as Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOrderById } from '@/lib/orderService';
import {
  buildPrintStoreInfo,
  fetchOrderPaymentHistory,
  fetchPrintCompanyInfo,
  printFileTitle,
  type OrderPaymentRow,
  type PrintStoreInfo,
} from '@/lib/orderPrint';
import OrderPrintDocument from '@/components/orders/OrderPrintDocument';
import { Button } from '@/components/ui/button';
import type { Order } from '@/types';

// Margens definidas no próprio @page: o navegador aplica essas margens em
// todas as folhas, inclusive nas quebras de página.
const PAGE_CSS = '@page { size: A4; margin: 12mm; }';

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'ready'; order: Order; payments: OrderPaymentRow[]; store: PrintStoreInfo };

export default function OrderPrintPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    if (!orderId || !user?.id) return;
    let cancelled = false;

    (async () => {
      const order = await fetchOrderById(orderId);
      if (cancelled) return;

      // A RLS já restringe as linhas, mas a checagem explícita evita mostrar
      // um pedido de outra loja caso a query algum dia seja alterada.
      if (!order || order.store_owner_id !== user.id) {
        setState({ status: 'not_found' });
        return;
      }

      const [payments, company] = await Promise.all([
        order.order_type === 'ecommerce' ? fetchOrderPaymentHistory(order.id) : Promise.resolve([]),
        fetchPrintCompanyInfo(user.id),
      ]);
      if (cancelled) return;

      setState({
        status: 'ready',
        order,
        payments,
        store: buildPrintStoreInfo(user, company),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, user?.id]);

  // O título da aba vira o nome sugerido do arquivo ao "Salvar como PDF".
  useEffect(() => {
    if (state.status !== 'ready') return;
    const previousTitle = document.title;
    document.title = printFileTitle(state.order.id, state.order.created_at);
    return () => {
      document.title = previousTitle;
    };
  }, [state]);

  // Links de "Imprimir" nas telas do dashboard abrem com ?print=1 para que o
  // diálogo apareça assim que o pedido estiver pronto.
  useEffect(() => {
    if (state.status !== 'ready' || searchParams.get('print') !== '1') return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [state.status, searchParams]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.status === 'not_found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">Pedido não encontrado</p>
        <p className="text-sm text-muted-foreground">Verifique se o link está correto e se o pedido pertence à sua loja.</p>
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
        <Button size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" />
          Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="py-6 px-4 print:p-0">
        <div className="mx-auto max-w-[210mm] bg-white shadow-sm print:shadow-none">
          <OrderPrintDocument
            order={state.order}
            store={state.store}
            payments={state.payments}
            generatedAt={generatedAt}
          />
        </div>
      </div>
    </div>
  );
}
