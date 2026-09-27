import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  PAYMENT_METHOD_LABELS,
  describeFailureReason,
  fetchFailedPayments,
  formatCents,
  type FailedPaymentsPage,
  type FailureReason,
  type SalesWindow,
} from '@/lib/adminOnlineSales';

const PAGE_SIZE = 25;

interface FailedPaymentsTabProps {
  salesWindow: SalesWindow;
  reasons: FailureReason[];
}

export function FailedPaymentsTab({ salesWindow, reasons }: FailedPaymentsTabProps) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<FailedPaymentsPage | null>(null);
  const [loading, setLoading] = useState(true);

  // A new period/environment invalidates the current page number.
  useEffect(() => {
    setPage(0);
  }, [salesWindow]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFailedPayments(salesWindow, PAGE_SIZE, page * PAGE_SIZE)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar pagamentos que falharam');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salesWindow, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const maxReason = Math.max(1, ...reasons.map((r) => r.count));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por que os pagamentos falharam</CardTitle>
          <CardDescription>Principais motivos no período (recusados, cancelados e Pix expirados).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma falha no período.</p>
          ) : (
            reasons.map((r) => (
              <div key={r.reason} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{describeFailureReason(r.reason)}</span>
                  <span className="text-muted-foreground tabular-nums">{r.count} · {formatCents(r.cents)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-red-500/70" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></TableCell>
                  </TableRow>
                ) : !data || data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum pagamento falhou neste período.</TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((p) => (
                    <TableRow key={p.id} className={loading ? 'opacity-60' : ''}>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell className="text-sm">
                        <Link to={`/admin/users/${p.store_owner_id}`} className="hover:underline">{p.store_name || 'Sem nome'}</Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.customer_name}
                        {p.payer_email && <div className="text-xs text-muted-foreground">{p.payer_email}</div>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                        {p.card_brand && (
                          <span className="text-xs text-muted-foreground"> · {p.card_brand}{p.installments && p.installments > 1 ? ` ${p.installments}x` : ''}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCents(p.amount_cents)}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary" className="border-transparent bg-red-500/10 text-red-600 dark:text-red-400 font-normal whitespace-normal">
                          {describeFailureReason(p.status_detail || p.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{data ? `${data.total} pagamento(s)` : ''}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span>{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
