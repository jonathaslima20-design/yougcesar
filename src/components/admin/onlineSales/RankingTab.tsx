import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader as Loader2, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchOrdersRanking, formatCents, formatPercent, type OrderRankingRow, type SalesWindow } from '@/lib/adminOnlineSales';

type Source = 'all' | 'whatsapp' | 'online';
type SortBy = 'orders' | 'value';

const SOURCE_LABELS: Record<Source, string> = {
  all: 'Todos',
  whatsapp: 'WhatsApp',
  online: 'Pagamento online',
};

const TOP_HIGHLIGHT = 'bg-amber-500/15 text-amber-700 dark:text-amber-300';

interface Ranked extends OrderRankingRow {
  orders: number;
  cents: number;
}

function pick(row: OrderRankingRow, source: Source): { orders: number; cents: number } {
  if (source === 'whatsapp') return { orders: row.whatsapp_orders, cents: row.whatsapp_cents };
  if (source === 'online') return { orders: row.online_orders, cents: row.online_cents };
  return { orders: row.whatsapp_orders + row.online_orders, cents: row.whatsapp_cents + row.online_cents };
}

function csvEscape(value: string | number | null | undefined) {
  const s = String(value ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: Ranked[], source: Source) {
  const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const header = ['Posição', 'Loja', 'Email', `Pedidos (${SOURCE_LABELS[source]})`, 'Valor (R$)', 'Pedidos WhatsApp', 'Pedidos pagamento online', 'Último pedido'];
  const lines = rows.map((r, i) =>
    [i + 1, r.name, r.email, r.orders, money(r.cents), r.whatsapp_orders, r.online_orders, r.last_order_at ?? ''].map(csvEscape).join(';')
  );
  // BOM so Excel opens the accents correctly; ";" because pt-BR Excel splits on it.
  const blob = new Blob(['﻿' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ranking-lojistas-${source}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RankingTab({ salesWindow }: { salesWindow: SalesWindow }) {
  const [rows, setRows] = useState<OrderRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>('all');
  const [sortBy, setSortBy] = useState<SortBy>('orders');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOrdersRanking(salesWindow)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar o ranking');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salesWindow]);

  // Ranked before the search filter so a merchant keeps their real position
  // when the admin searches for them.
  const ranked = useMemo(() => {
    const withValues: Ranked[] = rows.map((r) => ({ ...r, ...pick(r, source) })).filter((r) => r.orders > 0);
    const primary = sortBy === 'orders' ? 'orders' : 'cents';
    const secondary = sortBy === 'orders' ? 'cents' : 'orders';
    return withValues.sort((a, b) => b[primary] - a[primary] || b[secondary] - a[secondary] || (a.name ?? '').localeCompare(b.name ?? ''));
  }, [rows, source, sortBy]);

  const totals = useMemo(() => {
    const orders = ranked.reduce((s, r) => s + r.orders, 0);
    const cents = ranked.reduce((s, r) => s + r.cents, 0);
    const top5 = ranked.slice(0, 5);
    const top5Orders = top5.reduce((s, r) => s + r.orders, 0);
    const top5Cents = top5.reduce((s, r) => s + r.cents, 0);
    return { orders, cents, top5Count: top5.length, top5Orders, top5Cents };
  }, [ranked]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withPosition = ranked.map((r, i) => ({ r, position: i + 1 }));
    if (!q) return withPosition;
    return withPosition.filter(({ r }) => [r.name, r.email, r.slug].some((v) => v?.toLowerCase().includes(q)));
  }, [ranked, query]);

  const maxOrders = Math.max(1, ...ranked.map((r) => r.orders));
  const valueLabel = source === 'whatsapp' ? 'Valor dos carrinhos' : source === 'online' ? 'Valor pago' : 'Valor (carrinhos + pago)';
  const sortMetric = sortBy === 'orders' ? 'pedidos' : 'valor';
  const top5Share = sortBy === 'orders' ? (totals.orders > 0 ? (totals.top5Orders / totals.orders) * 100 : 0) : totals.cents > 0 ? (totals.top5Cents / totals.cents) * 100 : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
              <Button key={s} size="sm" variant={source === s ? 'default' : 'outline'} className="h-8" onClick={() => setSource(s)}>
                {SOURCE_LABELS[s]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-2">
            <Button size="sm" variant={sortBy === 'orders' ? 'secondary' : 'ghost'} className="h-8" onClick={() => setSortBy('orders')}>Mais pedidos</Button>
            <Button size="sm" variant={sortBy === 'value' ? 'secondary' : 'ghost'} className="h-8" onClick={() => setSortBy('value')}>Maior valor</Button>
          </div>
          <div className="relative flex-1 max-w-xs lg:ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar loja ou e-mail..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCsv(ranked, source)} disabled={ranked.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Pedidos no período</div>
                <div className="text-xl font-bold tabular-nums">{totals.orders}</div>
                <div className="text-xs text-muted-foreground">{ranked.length} lojista(s) com pedidos</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{valueLabel}</div>
                <div className="text-xl font-bold tabular-nums">{formatCents(totals.cents)}</div>
                <div className="text-xs text-muted-foreground">ticket médio {formatCents(totals.orders > 0 ? totals.cents / totals.orders : 0)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Concentração</div>
                <div className="text-xl font-bold tabular-nums">{ranked.length === 0 ? '—' : formatPercent(top5Share, 0)}</div>
                <div className="text-xs text-muted-foreground">
                  {ranked.length === 0 ? 'sem pedidos' : `dos ${sortMetric} vêm ${totals.top5Count === 1 ? 'do maior lojista' : `dos ${totals.top5Count} maiores lojistas`}`}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Lojista</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">{valueLabel}</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="text-right">% do total</TableHead>
                    {source === 'all' && <TableHead>WhatsApp × Online</TableHead>}
                    <TableHead>Último pedido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={source === 'all' ? 8 : 7} className="text-center text-muted-foreground py-10">
                        Nenhum pedido {source === 'whatsapp' ? 'de WhatsApp ' : source === 'online' ? 'com pagamento online ' : ''}neste período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map(({ r, position }) => {
                      const share = sortBy === 'orders' ? (totals.orders > 0 ? (r.orders / totals.orders) * 100 : 0) : totals.cents > 0 ? (r.cents / totals.cents) * 100 : 0;
                      const waShare = r.orders > 0 ? (r.whatsapp_orders / (r.whatsapp_orders + r.online_orders)) * 100 : 0;
                      return (
                        <TableRow key={r.user_id}>
                          <TableCell>
                            <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${position <= 3 ? TOP_HIGHLIGHT : 'text-muted-foreground'}`}>
                              {position}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link to={`/admin/users/${r.user_id}`} className="font-medium hover:underline">{r.name || 'Sem nome'}</Link>
                            <div className="text-xs text-muted-foreground">{r.email}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="tabular-nums font-medium">{r.orders}</div>
                            <div className="mt-1 ml-auto h-1 w-20 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.orders / maxOrders) * 100}%` }} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatCents(r.cents)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{formatCents(r.orders > 0 ? r.cents / r.orders : 0)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{formatPercent(share)}</TableCell>
                          {source === 'all' && (
                            <TableCell>
                              <div className="h-1.5 w-28 rounded-full bg-emerald-500/70 overflow-hidden" title={`${r.whatsapp_orders} WhatsApp · ${r.online_orders} online`}>
                                <div className="h-full bg-sky-500/80" style={{ width: `${waShare}%` }} />
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">{r.whatsapp_orders} WhatsApp · {r.online_orders} online</div>
                            </TableCell>
                          )}
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {r.last_order_at ? formatDistanceToNow(new Date(r.last_order_at), { addSuffix: true, locale: ptBR }) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              WhatsApp = pedidos registrados (sem os cancelados), com o valor do carrinho declarado — não é dinheiro confirmado.
              Pagamento online = só pagamentos aprovados (reembolsados ficam de fora), no ambiente {salesWindow.environment === 'production' ? 'de produção' : 'de teste'}; o filtro de ambiente não afeta os pedidos de WhatsApp.
              "% do total" segue a ordenação escolhida (pedidos ou valor).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
