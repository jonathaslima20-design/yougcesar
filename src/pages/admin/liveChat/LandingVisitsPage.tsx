import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchLandingVisitMetrics } from '@/lib/liveChat/adminService';
import { LANDING_SECTION_LABELS } from '@/lib/liveChat/format';
import type { LandingVisitMetrics } from '@/lib/liveChat/types';
import { cn } from '@/lib/utils';

const PERIODS = [7, 30, 90] as const;
const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--popover-foreground))',
};
// ordem em que as seções aparecem na landing
const SECTION_ORDER = ['top', 'recursos', 'usuarios', 'precos', 'faq', 'cta'];

function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${((part / total) * 100).toFixed(1).replace('.', ',')}%`;
}

function duration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  return `${m}min ${String(seconds % 60).padStart(2, '0')}s`;
}

function shortDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm text-muted-foreground font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Barra horizontal de proporção (uma cor só: magnitude). */
function ShareBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function LandingVisitsPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const [data, setData] = useState<LandingVisitMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const load = (d: number) => {
    setLoading(true);
    fetchLandingVisitMetrics(d)
      .then((m) => {
        setData(m);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(days);
  }, [days]);

  const daily = useMemo(
    () => (data?.by_day ?? []).map((d) => ({ ...d, label: shortDay(d.day) })),
    [data],
  );
  const hours = useMemo(() => (data?.hours ?? []).map((h) => ({ ...h, label: `${String(h.hour).padStart(2, '0')}h` })), [data]);
  const peakHour = useMemo(() => (data?.hours ?? []).reduce((best, h) => (h.sessions > (best?.sessions ?? 0) ? h : best), null as null | { hour: number; sessions: number }), [data]);
  const sections = useMemo(() => {
    if (!data) return [];
    // toda visita começa no topo; as outras seções são registradas no sinal de 30 s e na saída
    const known = SECTION_ORDER.map((id) => ({ id, count: id === 'top' ? data.sessions : data.section_reach[id] ?? 0 }));
    const others = Object.entries(data.section_reach)
      .filter(([id]) => !SECTION_ORDER.includes(id) && id !== 'footer')
      .map(([id, count]) => ({ id, count }));
    return [...known, ...others];
  }, [data]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Visitas da Landing</h1>
          <p className="text-sm text-muted-foreground">
            Quem visitou a landing page (versão em português), de onde veio, o que viu e quantos viraram conversa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDays(p)}
                className={cn('px-3 py-1.5 text-sm', days === p ? 'bg-foreground text-background' : 'hover:bg-muted')}
              >
                {p} dias
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => load(days)} aria-label="Atualizar" disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <div className="h-40 flex items-center justify-center text-muted-foreground">Carregando…</div>}

      {data && (
        <>
          {!data.tracking_enabled && (
            <p className="text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
              O monitoramento está desligado: novas visitas não estão sendo contadas. Ative em{' '}
              <Link to="/admin/live-chat/settings" className="underline font-medium">Configurações do Atendimento</Link>.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Contamos visitas enquanto o monitoramento está ligado.
            {data.first_day && ` Primeira visita registrada no período: ${shortDay(data.first_day)}.`}
            {data.unique_is_partial &&
              ` Visitantes únicos cobrem só os últimos ${data.session_retention_days} dias (as sessões são apagadas pela retenção); os demais números cobrem o período inteiro.`}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Visitas" value={data.sessions} hint={`${data.live_now} na página agora`} />
            <Stat label="Visitantes únicos" value={data.unique_visitors} hint={`${pct(data.new_visitors, data.sessions)} das visitas são de primeira vez`} />
            <Stat label="Tempo médio na página" value={duration(data.avg_duration_seconds)} />
            <Stat label="Taxa de rejeição" value={pct(data.bounces, data.sessions)} hint="Saiu em menos de 15 s sem rolar a página" />
            <Stat label="Visitas que viraram conversa" value={pct(data.conversations, data.sessions)} hint={`${data.conversations} conversas`} />
            <Stat label="Leads de WhatsApp" value={data.whatsapp_leads} hint={`${pct(data.whatsapp_leads, data.sessions)} das visitas`} />
            <Card className="col-span-2">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-muted-foreground font-normal">Dispositivo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-sm"><Smartphone className="h-4 w-4 text-muted-foreground" /> Celular</p>
                  <p className="text-xl font-bold tabular-nums">{pct(data.mobile, data.sessions)}</p>
                  <ShareBar value={data.mobile} max={data.sessions} />
                  <p className="text-xs text-muted-foreground">{data.mobile} visitas</p>
                </div>
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-sm"><Monitor className="h-4 w-4 text-muted-foreground" /> Computador</p>
                  <p className="text-xl font-bold tabular-nums">{pct(data.desktop, data.sessions)}</p>
                  <ShareBar value={data.desktop} max={data.sessions} />
                  <p className="text-xs text-muted-foreground">{data.desktop} visitas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Visitas por dia</CardTitle>
                <CardDescription>Passe o mouse sobre uma barra para ver visitantes únicos, conversas e leads do dia.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'Ver gráfico' : 'Ver tabela'}
              </Button>
            </CardHeader>
            <CardContent>
              {showTable ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dia</TableHead>
                      <TableHead className="text-right">Visitas</TableHead>
                      <TableHead className="text-right">Únicos</TableHead>
                      <TableHead className="text-right">Conversas</TableHead>
                      <TableHead className="text-right">WhatsApp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...daily].reverse().map((d) => (
                      <TableRow key={d.day}>
                        <TableCell>{d.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.sessions}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.unique_visitors}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.conversations}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.whatsapp}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap={2}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                      contentStyle={TOOLTIP_STYLE}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as (typeof daily)[number];
                        return (
                          <div style={TOOLTIP_STYLE} className="px-3 py-2 text-xs space-y-0.5">
                            <p className="font-medium">{d.label}</p>
                            <p>{d.sessions} visitas · {d.unique_visitors} únicos</p>
                            <p>{d.conversations} conversas · {d.whatsapp} leads de WhatsApp</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="sessions" name="Visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Até onde as pessoas rolam</CardTitle>
                <CardDescription>
                  % das visitas que chegaram a ver cada seção, na ordem da página. A seção é registrada a cada 30 s e na saída,
                  então quem passa muito rápido por uma seção pode não ser contado nela.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sections.map((s) => (
                  <div key={s.id} className="space-y-1" title={`${s.count} de ${data.sessions} visitas`}>
                    <div className="flex justify-between text-sm">
                      <span>{LANDING_SECTION_LABELS[s.id] ?? s.id}</span>
                      <span className="tabular-nums text-muted-foreground">{pct(s.count, data.sessions)}</span>
                    </div>
                    <ShareBar value={s.count} max={data.sessions} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Horário das visitas</CardTitle>
                <CardDescription>
                  Visitas por hora do dia ({data.timezone.replace('America/', '').replace('_', ' ')}).
                  {peakHour && peakHour.sessions > 0 && ` Pico às ${String(peakHour.hour).padStart(2, '0')}h.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hours} margin={{ top: 5, right: 5, left: 0, bottom: 5 }} barCategoryGap={2}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [`${value} visitas`, 'Visitas']}
                    />
                    <Bar dataKey="sessions" name="Visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">De onde vieram</CardTitle>
              <CardDescription>Origem pela UTM (utm_source) ou pelo site que mandou a visita. “Direto” = sem origem conhecida.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right w-24">Visitas</TableHead>
                    <TableHead className="w-[40%]">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sources.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem visitas no período.</TableCell></TableRow>
                  ) : (
                    data.sources.map((s) => (
                      <TableRow key={s.source}>
                        <TableCell className="max-w-[260px] truncate">{s.source}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.sessions}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ShareBar value={s.sessions} max={data.sessions} />
                            <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{pct(s.sessions, data.sessions)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
