import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, startOfDay, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertTriangle, Ban, Clock, Loader as Loader2, Plug, RefreshCw, RotateCcw, ShoppingBag, TrendingUp, Wallet,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionsTab, type ConnectionFilter } from '@/components/admin/onlineSales/ConnectionsTab';
import { FailedPaymentsTab } from '@/components/admin/onlineSales/FailedPaymentsTab';
import { MerchantsTab } from '@/components/admin/onlineSales/MerchantsTab';
import { SalesChart } from '@/components/admin/onlineSales/SalesChart';
import {
  PAYMENT_METHOD_LABELS,
  approvalRate,
  fetchOnlineSalesByMerchant,
  fetchOnlineSalesOverview,
  formatCents,
  formatPercent,
  getConnectionState,
  isExpiringSoon,
  type MerchantSalesRow,
  type OnlineSalesOverview,
  type SalesEnvironment,
  type SalesWindow,
} from '@/lib/adminOnlineSales';

type Preset = 'today' | '7d' | '30d' | '90d' | 'month' | 'prev_month' | 'year';

const PRESET_LABELS: Record<Preset, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  month: 'Este mês',
  prev_month: 'Mês passado',
  year: 'Este ano',
};

// `to` is exclusive (start of the day after the last day shown).
function resolvePreset(preset: Preset): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  switch (preset) {
    case 'today': return { from: today, to: tomorrow };
    case '7d': return { from: subDays(today, 6), to: tomorrow };
    case '30d': return { from: subDays(today, 29), to: tomorrow };
    case '90d': return { from: subDays(today, 89), to: tomorrow };
    case 'month': return { from: startOfMonth(today), to: tomorrow };
    case 'prev_month': return { from: startOfMonth(subMonths(today, 1)), to: startOfMonth(today) };
    case 'year': return { from: startOfYear(today), to: tomorrow };
  }
}

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'good' | 'bad';
}

function Kpi({ label, value, hint, icon: Icon, tone = 'default' }: KpiProps) {
  const color = tone === 'good' ? 'text-green-600 dark:text-green-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : '';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function OnlineSalesPage() {
  const [preset, setPreset] = useState<Preset>('30d');
  const [environment, setEnvironment] = useState<SalesEnvironment>('production');
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState('merchants');
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>('all');

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OnlineSalesOverview | null>(null);
  const [merchants, setMerchants] = useState<MerchantSalesRow[]>([]);

  // Recomputed on refresh too, so "today" rolls over and the tabs refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const salesWindow = useMemo<SalesWindow>(() => ({ ...resolvePreset(preset), environment }), [preset, environment, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchOnlineSalesOverview(salesWindow), fetchOnlineSalesByMerchant(salesWindow)])
      .then(([o, m]) => {
        if (cancelled) return;
        setOverview(o);
        setMerchants(m);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar vendas online');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salesWindow]);

  const connections = useMemo(() => {
    const withCreds = merchants.filter((m) => m.has_credentials);
    const states = withCreds.map((m) => getConnectionState(m));
    return {
      total: withCreds.length,
      connected: states.filter((s) => s === 'connected' || s === 'paused').length,
      expired: states.filter((s) => s === 'expired').length,
      reconnect: states.filter((s) => s === 'reconnect').length,
      expiring: withCreds.filter((m) => isExpiringSoon(m)).length,
    };
  }, [merchants]);

  const lowApproval = useMemo(
    () =>
      merchants.filter((m) => {
        const rate = approvalRate(m.approved_count, m.failed_count, m.expired_count);
        return rate !== null && rate < 50 && m.approved_count + m.failed_count + m.expired_count >= 5;
      }),
    [merchants]
  );

  const openConnections = useCallback((f: ConnectionFilter) => {
    setConnectionFilter(f);
    setTab('connections');
  }, []);

  const t = overview?.totals;
  const rate = t ? approvalRate(t.approved_count, t.failed_count, t.expired_count) : null;
  const avgTicket = t && t.approved_count > 0 ? t.approved_cents / t.approved_count : 0;
  const effectiveFee = t && t.approved_cents > 0 ? (t.fee_cents / t.approved_cents) * 100 : 0;

  const alerts: { key: string; text: string; action?: () => void; actionLabel?: string }[] = [];
  if (connections.expired > 0) {
    alerts.push({ key: 'expired', text: `${connections.expired} lojista(s) com token do Mercado Pago vencido — a renovação automática falhou e eles não conseguem vender.`, action: () => openConnections('expired'), actionLabel: 'Ver' });
  }
  if (connections.reconnect > 0) {
    alerts.push({ key: 'reconnect', text: `${connections.reconnect} lojista(s) ainda no modelo antigo (token colado à mão): o checkout recusa e você não recebe taxa até reconectarem.`, action: () => openConnections('reconnect'), actionLabel: 'Ver' });
  }
  if (connections.expiring > 0) {
    alerts.push({ key: 'expiring', text: `${connections.expiring} token(s) vencem nos próximos 30 dias.`, action: () => openConnections('expiring'), actionLabel: 'Ver' });
  }
  if (lowApproval.length > 0) {
    alerts.push({ key: 'low', text: `${lowApproval.length} lojista(s) com aprovação abaixo de 50% no período: ${lowApproval.slice(0, 3).map((m) => m.name || m.email).join(', ')}${lowApproval.length > 3 ? '…' : ''}.`, action: () => setTab('failed'), actionLabel: 'Ver falhas' });
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Vendas Online</h1>
          <p className="text-sm text-muted-foreground">
            Conexões Mercado Pago, vendas pagas online, o que você ganhou de taxa e o que deu errado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                <SelectItem key={p} value={p}>{PRESET_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as SalesEnvironment)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Produção</SelectItem>
              <SelectItem value="test">Teste</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setReloadKey((k) => k + 1)} disabled={loading} title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {environment === 'test' && (
        <Alert>
          <AlertDescription className="text-xs">
            Mostrando pagamentos de <strong>teste</strong> (sandbox do Mercado Pago). Não são vendas reais e não geram taxa de verdade.
          </AlertDescription>
        </Alert>
      )}

      {loading && !overview ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !overview || !t ? null : (
        <>
          {alerts.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-800">
              <CardContent className="pt-6 space-y-3">
                {alerts.map((a) => (
                  <div key={a.key} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="flex-1">{a.text}</span>
                    {a.action && <Button variant="link" size="sm" className="h-auto p-0" onClick={a.action}>{a.actionLabel}</Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Volume vendido" value={formatCents(t.approved_cents)} hint={`ticket médio ${formatCents(avgTicket)}`} icon={ShoppingBag} />
            <Kpi
              label="Seus ganhos (taxa)"
              value={formatCents(t.fee_cents)}
              hint={`${formatPercent(effectiveFee, 2)} do volume · taxa configurada ${formatPercent(overview.fee_percentage, 2)}${t.fee_estimated_count > 0 ? ` · ${t.fee_estimated_count} venda(s) estimada(s)` : ''}`}
              icon={Wallet}
              tone="good"
            />
            <Kpi label="Vendas aprovadas" value={String(t.approved_count)} hint={`${t.selling_merchants} lojista(s) vendendo`} icon={TrendingUp} />
            <Kpi
              label="Mercado Pago conectado"
              value={`${connections.connected} de ${connections.total}`}
              hint={connections.total === 0 ? 'nenhum lojista conectou ainda' : 'lojistas que concluíram a conexão'}
              icon={Plug}
            />
            <Kpi label="Taxa de aprovação" value={rate === null ? '—' : formatPercent(rate)} hint="aprovados / tentativas finalizadas" icon={TrendingUp} tone={rate !== null && rate < 60 ? 'bad' : 'default'} />
            <Kpi label="Pagamentos que falharam" value={String(t.failed_count)} hint={`${formatCents(t.failed_cents)} recusados/cancelados`} icon={Ban} tone={t.failed_count > 0 ? 'bad' : 'default'} />
            <Kpi label="Pix expirados" value={String(t.expired_count)} hint={`${formatCents(t.expired_cents)} não pagos`} icon={Clock} />
            <Kpi label="Reembolsos / estornos" value={String(t.refunded_count)} hint={`${formatCents(t.refunded_cents)} devolvidos (sem taxa)`} icon={RotateCcw} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesChart daily={overview.daily} from={salesWindow.from} to={salesWindow.to} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por método de pagamento</CardTitle>
                <CardDescription>Só vendas aprovadas no período.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {overview.by_method.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem pagamentos no período.</p>
                ) : (
                  overview.by_method.map((m) => {
                    const share = t.approved_cents > 0 ? (m.approved_cents / t.approved_cents) * 100 : 0;
                    const methodRate = approvalRate(m.approved_count, m.failed_count, 0);
                    return (
                      <div key={m.method} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                          <span className="tabular-nums">{formatCents(m.approved_cents)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{m.approved_count} venda(s) · taxa {formatCents(m.fee_cents)}</span>
                          <span>{methodRate === null ? '—' : `${formatPercent(methodRate)} aprovação`}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="merchants">Por lojista</TabsTrigger>
              <TabsTrigger value="connections">Conexões Mercado Pago</TabsTrigger>
              <TabsTrigger value="failed">Vendas que falharam</TabsTrigger>
            </TabsList>
            <TabsContent value="merchants" className="mt-4">
              <MerchantsTab rows={merchants} />
            </TabsContent>
            <TabsContent value="connections" className="mt-4">
              <ConnectionsTab rows={merchants} filter={connectionFilter} onFilterChange={setConnectionFilter} />
            </TabsContent>
            <TabsContent value="failed" className="mt-4">
              <FailedPaymentsTab salesWindow={salesWindow} reasons={overview.failure_reasons} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
