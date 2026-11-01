import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchMetrics } from '@/lib/liveChat/adminService';
import type { LiveChatMetrics } from '@/lib/liveChat/types';
import { cn } from '@/lib/utils';

const PERIODS = [7, 30, 90] as const;

function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${((part / total) * 100).toFixed(1).replace('.', ',')}%`;
}

function duration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min ${seconds % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
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

export default function LiveChatMetricsPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const [data, setData] = useState<LiveChatMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchMetrics(days)
      .then((m) => {
        setData(m);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar métricas'));
  }, [days]);

  const sessionsReliable = data ? days <= data.session_retention_days : true;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Métricas do Atendimento</h1>
          <p className="text-sm text-muted-foreground">Conversas, leads de WhatsApp e tempo de resposta do chat da landing.</p>
        </div>
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
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <div className="h-40 flex items-center justify-center text-muted-foreground">Carregando…</div>}

      {data && (
        <>
          {!sessionsReliable && (
            <p className="text-xs rounded-md border bg-muted/40 p-3 text-muted-foreground">
              Sessões sem conversa são apagadas após {data.session_retention_days} dias (retenção LGPD). Para períodos maiores,
              “Visitas” e a taxa de conversa cobrem só os últimos {data.session_retention_days} dias; conversas e leads cobrem o
              período inteiro.
            </p>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Visitas monitoradas" value={data.sessions} />
            <Stat
              label="Conversas"
              value={data.conversations}
              hint={`${pct(data.conversations, data.sessions)} das visitas · ${data.operator_started} iniciadas por você`}
            />
            <Stat label="Leads de WhatsApp" value={data.whatsapp_leads} hint={`${pct(data.whatsapp_leads, data.conversations)} das conversas`} />
            <Stat label="Leads contatados" value={data.contacted} hint={`${pct(data.contacted, data.whatsapp_leads)} dos leads`} />
            <Stat label="Tempo médio da 1ª resposta" value={duration(data.avg_first_response_seconds)} />
            <Stat
              label="Conversas sem resposta"
              value={data.unanswered}
              hint={`${pct(data.unanswered, data.visitor_started)} das abertas pelo visitante`}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Por persona</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Persona</TableHead>
                      <TableHead className="text-right">Conversas</TableHead>
                      <TableHead className="text-right">WhatsApp</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_operator.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem conversas no período.</TableCell></TableRow>
                    ) : (
                      data.by_operator.map((r) => (
                        <TableRow key={r.name}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.conversations}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.whatsapp}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct(r.whatsapp, r.conversations)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Por origem</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem (UTM ou site)</TableHead>
                      <TableHead className="text-right">Conversas</TableHead>
                      <TableHead className="text-right">WhatsApp</TableHead>
                      <TableHead className="text-right">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_source.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem conversas no período.</TableCell></TableRow>
                    ) : (
                      data.by_source.map((r) => (
                        <TableRow key={r.source}>
                          <TableCell className="max-w-[220px] truncate">{r.source}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.conversations}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.whatsapp}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct(r.whatsapp, r.conversations)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Por dia</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead className="text-right">Conversas</TableHead>
                    <TableHead className="text-right">WhatsApp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.by_day].reverse().map((d) => (
                    <TableRow key={d.day}>
                      <TableCell>
                        {new Date(`${d.day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.sessions}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.conversations}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.whatsapp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
