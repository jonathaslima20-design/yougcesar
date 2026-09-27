import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CONNECTION_LABELS, daysUntilExpiry, getConnectionState, isExpiringSoon, type ConnectionState, type MerchantSalesRow } from '@/lib/adminOnlineSales';
import { ConnectionBadge } from './ConnectionBadge';

export type ConnectionFilter = 'all' | ConnectionState | 'expiring';

const FILTER_ORDER: ConnectionFilter[] = ['all', 'connected', 'paused', 'expiring', 'expired', 'reconnect', 'incomplete'];

function filterLabel(f: ConnectionFilter) {
  if (f === 'all') return 'Todos';
  if (f === 'expiring') return 'Vencendo em 30 dias';
  return CONNECTION_LABELS[f];
}

// Worst problems first so the ones needing action are at the top of the list.
const STATE_RANK: Record<ConnectionState, number> = { expired: 0, reconnect: 1, incomplete: 2, paused: 3, connected: 4 };

interface ConnectionsTabProps {
  rows: MerchantSalesRow[];
  filter: ConnectionFilter;
  onFilterChange: (f: ConnectionFilter) => void;
}

export function ConnectionsTab({ rows, filter, onFilterChange }: ConnectionsTabProps) {
  const withState = useMemo(
    () => rows.filter((r) => r.has_credentials).map((r) => ({ row: r, state: getConnectionState(r) })),
    [rows]
  );

  const counts = useMemo(() => {
    const c: Record<ConnectionFilter, number> = { all: withState.length, connected: 0, paused: 0, expired: 0, reconnect: 0, incomplete: 0, expiring: 0 };
    withState.forEach(({ row, state }) => {
      c[state] += 1;
      if (isExpiringSoon(row)) c.expiring += 1;
    });
    return c;
  }, [withState]);

  const visible = useMemo(
    () =>
      withState
        .filter(({ row, state }) => filter === 'all' || (filter === 'expiring' ? isExpiringSoon(row) : state === filter))
        .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || (a.row.name ?? '').localeCompare(b.row.name ?? '')),
    [withState, filter]
  );

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTER_ORDER.map((f) => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="h-8" onClick={() => onFilterChange(f)}>
              {filterLabel(f)} <span className="ml-1.5 opacity-70">{counts[f]}</span>
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lojista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conta Mercado Pago</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Token vence em</TableHead>
                <TableHead>Cadastrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum lojista nesse filtro.</TableCell>
                </TableRow>
              ) : (
                visible.map(({ row: r, state }) => {
                  const days = daysUntilExpiry(r);
                  return (
                    <TableRow key={r.user_id}>
                      <TableCell>
                        <Link to={`/admin/users/${r.user_id}`} className="font-medium hover:underline">{r.name || 'Sem nome'}</Link>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell><ConnectionBadge state={state} /></TableCell>
                      <TableCell className="text-sm">
                        {r.mp_account_email ?? <span className="text-muted-foreground">—</span>}
                        {r.mp_user_id && <div className="text-xs text-muted-foreground">ID {r.mp_user_id}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{r.environment === 'production' ? 'Produção' : r.environment === 'test' ? 'Teste' : '—'}</TableCell>
                      <TableCell className={`text-sm ${days !== null && days <= 30 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                        {days === null ? '—' : days < 0 ? `venceu há ${-days} dia(s)` : `${days} dia(s)`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {r.connected_since ? format(new Date(r.connected_since), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          "Precisa reconectar" = ainda usa o token colado à mão (modelo antigo): o checkout recusa e nenhuma taxa é cobrada até reconectar via OAuth.
          "Token vencido" indica que a renovação automática falhou.
        </p>
      </CardContent>
    </Card>
  );
}
