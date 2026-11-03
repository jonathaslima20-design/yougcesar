import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, MousePointerClick, TrendingUp, UserPlus, Users } from 'lucide-react';
import { partnerApi, type PartnerClient, type PartnerFunnelRow } from '@/lib/partners/partnerApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader, StatCard } from '@/components/partners/PartnerUi';

const PERIODS = [7, 30, 90, 365];

const ORIGIN_LABELS: Record<string, string> = {
  link: 'Links',
  coupon: 'Cupom',
  lead: 'Oportunidades',
  created: 'Lojas criadas por você',
  manual: 'Ajuste do suporte',
  legacy: 'Programa anterior',
  directory: 'Diretório',
};

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '—');

export default function PartnersPerformancePage() {
  const [days, setDays] = useState(30);
  const [funnel, setFunnel] = useState<PartnerFunnelRow[] | null>(null);
  const [clients, setClients] = useState<PartnerClient[]>([]);

  useEffect(() => {
    setFunnel(null);
    partnerApi.funnel(days).then(setFunnel).catch(() => setFunnel([]));
  }, [days]);

  useEffect(() => {
    partnerApi.clients().then(setClients).catch(() => undefined);
  }, []);

  const totals = useMemo(
    () => (funnel ?? []).reduce((acc, r) => ({ clicks: acc.clicks + r.clicks, signups: acc.signups + r.signups, paying: acc.paying + r.paying }), { clicks: 0, signups: 0, paying: 0 }),
    [funnel],
  );

  const byOrigin = useMemo(() => {
    const map = new Map<string, { origin: string; total: number; active: number }>();
    for (const c of clients) {
      const row = map.get(c.origin) ?? { origin: ORIGIN_LABELS[c.origin] ?? c.origin, total: 0, active: 0 };
      row.total += 1;
      if (c.plan_status === 'active') row.active += 1;
      map.set(c.origin, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [clients]);

  const churnRisk = clients.filter((c) => c.health === 'at_risk' || c.health === 'lapsed').length;
  const retention = clients.length ? clients.filter((c) => c.plan_status === 'active').length / clients.length : 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Desempenho"
        description="Do clique ao cliente pagante, por link."
        actions={
          <div className="flex gap-1 rounded-lg border p-1">
            {PERIODS.map((p) => (
              <Button key={p} size="sm" variant={days === p ? 'default' : 'ghost'} className="h-7" onClick={() => setDays(p)}>
                {p === 365 ? '12 meses' : `${p} dias`}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cliques" value={totals.clicks} icon={MousePointerClick} loading={funnel === null} />
        <StatCard title="Cadastros" value={totals.signups} hint={`Conversão ${pct(totals.signups, totals.clicks)}`} icon={UserPlus} loading={funnel === null} />
        <StatCard title="Pagantes" value={totals.paying} hint={`${pct(totals.paying, totals.signups)} dos cadastros`} icon={TrendingUp} loading={funnel === null} accent="green" />
        <StatCard title="Carteira ativa" value={`${Math.round(retention * 100)}%`} hint={`${churnRisk} cliente(s) em risco`} icon={Users} accent={churnRisk ? 'amber' : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Funil por link</CardTitle></CardHeader>
        <CardContent>
          {funnel === null ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnel.filter((f) => f.clicks + f.signups > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="link_name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="clicks" name="Cliques" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="signups" name="Cadastros" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="paying" name="Pagantes" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Link</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                      <TableHead className="text-right">Cadastros</TableHead>
                      <TableHead className="text-right">Pagantes</TableHead>
                      <TableHead className="text-right">Clique → cadastro</TableHead>
                      <TableHead className="text-right">Cadastro → pagante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnel.map((r) => (
                      <TableRow key={r.link_id ?? 'none'}>
                        <TableCell className="font-medium">{r.link_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.clicks}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.signups}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.paying}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(r.signups, r.clicks)}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(r.paying, r.signups)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Carteira por origem</CardTitle></CardHeader>
        <CardContent>
          {byOrigin.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem clientes ainda.</p>
          ) : (
            <div className="space-y-3">
              {byOrigin.map((o) => (
                <div key={o.origin}>
                  <div className="flex justify-between text-sm"><span>{o.origin}</span><span className="tabular-nums text-muted-foreground">{o.active} ativos de {o.total}</span></div>
                  <div className="h-2 rounded-full bg-muted mt-1.5 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(o.total / Math.max(clients.length, 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
