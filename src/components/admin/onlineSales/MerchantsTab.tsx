import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { approvalRate, formatCents, formatPercent, getConnectionState, type MerchantSalesRow } from '@/lib/adminOnlineSales';
import { ConnectionBadge } from './ConnectionBadge';

type SortKey = 'name' | 'approved_count' | 'approved_cents' | 'fee_cents' | 'failed_count' | 'rate';

function rateOf(r: MerchantSalesRow) {
  return approvalRate(r.approved_count, r.failed_count, r.expired_count);
}

function csvEscape(value: string | number | null | undefined) {
  const s = String(value ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: MerchantSalesRow[]) {
  const header = ['Loja', 'Email', 'Conexão MP', 'Conta MP', 'Vendas aprovadas', 'Volume (R$)', 'Taxa recebida (R$)', 'Falhas', 'Pix expirados', 'Reembolsos', 'Taxa de aprovação (%)', 'Última venda'];
  const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const lines = rows.map((r) => {
    const rate = rateOf(r);
    return [
      r.name, r.email, getConnectionState(r), r.mp_account_email, r.approved_count, money(r.approved_cents), money(r.fee_cents),
      r.failed_count, r.expired_count, r.refunded_count, rate === null ? '' : rate.toFixed(1).replace('.', ','), r.last_sale_at ?? '',
    ].map(csvEscape).join(';');
  });
  // BOM so Excel opens the accents correctly; ";" because pt-BR Excel splits on it.
  const blob = new Blob(['﻿' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vendas-online-por-lojista-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface SortHeadProps {
  k: SortKey;
  active: SortKey;
  desc: boolean;
  onSort: (k: SortKey) => void;
  className?: string;
  children: React.ReactNode;
}

function SortHead({ k, active, desc, onSort, className, children }: SortHeadProps) {
  return (
    <TableHead className={className}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {active === k && (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
}

export function MerchantsTab({ rows }: { rows: MerchantSalesRow[] }) {
  const [query, setQuery] = useState('');
  const [onlyWithSales, setOnlyWithSales] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('approved_cents');
  const [sortDesc, setSortDesc] = useState(true);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (onlyWithSales && r.attempts === 0) return false;
      if (!q) return true;
      return [r.name, r.email, r.slug, r.mp_account_email].some((v) => v?.toLowerCase().includes(q));
    });
    const value = (r: MerchantSalesRow): string | number =>
      sortKey === 'name' ? (r.name ?? '').toLowerCase() : sortKey === 'rate' ? (rateOf(r) ?? -1) : r[sortKey];
    return [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDesc ? -cmp : cmp;
    });
  }, [rows, query, onlyWithSales, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(key !== 'name');
    }
  };

  const head = { active: sortKey, desc: sortDesc, onSort: toggleSort };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar loja, e-mail ou conta MP..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="only-with-sales" checked={onlyWithSales} onCheckedChange={setOnlyWithSales} />
            <Label htmlFor="only-with-sales" className="text-sm">Só quem teve tentativas no período</Label>
          </div>
          <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => exportCsv(visible)} disabled={visible.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="name" {...head}>Lojista</SortHead>
                <TableHead>Mercado Pago</TableHead>
                <SortHead k="approved_count" className="text-right" {...head}>Vendas</SortHead>
                <SortHead k="approved_cents" className="text-right" {...head}>Volume</SortHead>
                <SortHead k="fee_cents" className="text-right" {...head}>Sua taxa</SortHead>
                <SortHead k="failed_count" className="text-right" {...head}>Falhas</SortHead>
                <SortHead k="rate" className="text-right" {...head}>Aprovação</SortHead>
                <TableHead>Última venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Nenhum lojista encontrado neste período.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const rate = rateOf(r);
                  const finished = r.approved_count + r.failed_count + r.expired_count;
                  return (
                    <TableRow key={r.user_id}>
                      <TableCell>
                        <Link to={`/admin/users/${r.user_id}`} className="font-medium hover:underline">{r.name || 'Sem nome'}</Link>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell><ConnectionBadge state={getConnectionState(r)} /></TableCell>
                      <TableCell className="text-right tabular-nums">{r.approved_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCents(r.approved_cents)}</TableCell>
                      <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">{formatCents(r.fee_cents)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.failed_count + r.expired_count}
                        {r.expired_count > 0 && <span className="block text-xs text-muted-foreground">{r.expired_count} Pix expirado(s)</span>}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${rate !== null && rate < 50 && finished >= 5 ? 'text-red-600 dark:text-red-400' : ''}`}>
                        {rate === null ? '—' : formatPercent(rate)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {r.last_sale_at ? formatDistanceToNow(new Date(r.last_sale_at), { addSuffix: true, locale: ptBR }) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">{visible.length} de {rows.length} lojistas com Mercado Pago cadastrado ou vendas no período.</p>
      </CardContent>
    </Card>
  );
}
