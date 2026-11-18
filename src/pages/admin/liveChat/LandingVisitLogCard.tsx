import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Monitor, MousePointerClick, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchLandingVisitLog, LIVE_WINDOW_SECONDS } from '@/lib/liveChat/adminService';
import { sectionLabel } from '@/lib/liveChat/format';
import type { LandingVisitLog, LandingVisitLogEntry } from '@/lib/liveChat/types';
import { cn } from '@/lib/utils';

const SECTION_ORDER = ['top', 'recursos', 'usuarios', 'precos', 'faq', 'cta', 'footer'];
const SESSION_CAP_SECONDS = 7200;

type Filter = 'all' | 'scrolled' | 'clicked' | 'conversation';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'scrolled', label: 'Rolaram 50%+' },
  { id: 'clicked', label: 'Clicaram em algo' },
  { id: 'conversation', label: 'Viraram conversa' },
];

interface Props {
  days: number;
  offsetDays: number;
  timezone: string;
  retentionDays: number;
  reloadKey: number;
}

function secondsBetween(fromIso: string, toIso: string) {
  return Math.min(SESSION_CAP_SECONDS, Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000)));
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}min ${String(secs % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function offsetLabel(secs: number) {
  const m = Math.floor(secs / 60);
  return `+${m}:${String(secs % 60).padStart(2, '0')}`;
}

function sourceOf(v: LandingVisitLogEntry) {
  return v.utm_source || v.referrer_host || 'Direto';
}

function isLive(v: LandingVisitLogEntry) {
  return !v.ended_at && Date.now() - new Date(v.last_seen_at).getTime() < LIVE_WINDOW_SECONDS * 1000;
}

function clickCount(v: LandingVisitLogEntry) {
  return v.events.filter((e) => e.k === 'click').length;
}

export default function LandingVisitLogCard({ days, offsetDays, timezone, retentionDays, reloadKey }: Props) {
  const [log, setLog] = useState<LandingVisitLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const multiDay = days > 1;

  useEffect(() => {
    let active = true;
    fetchLandingVisitLog(days, offsetDays)
      .then((l) => {
        if (!active) return;
        setLog(l);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Erro ao carregar'));
    return () => {
      active = false;
    };
  }, [days, offsetDays, reloadKey]);

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        ...(multiDay ? { day: '2-digit', month: '2-digit' } : {}),
      }),
    [timezone, multiDay],
  );
  const clockFmt = useMemo(
    () => new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    [timezone],
  );

  const rows = useMemo(() => {
    const all = log?.sessions ?? [];
    switch (filter) {
      case 'scrolled':
        return all.filter((v) => v.max_scroll_pct >= 50);
      case 'clicked':
        return all.filter((v) => clickCount(v) > 0);
      case 'conversation':
        return all.filter((v) => v.conversation);
      default:
        return all;
    }
  }, [log, filter]);

  const beyondRetention = offsetDays + days > retentionDays;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-base">Log de visitas</CardTitle>
          <CardDescription>
            Cada visita com horário, tempo na página, até onde rolou e o que clicou. Clique numa linha para ver a linha do
            tempo. As visitas ficam guardadas por {retentionDays} dias
            {beyondRetention && ', então o log não cobre o período inteiro'}. Rolagem, tempo por seção e cliques só existem
            em visitas a partir de 17/11.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                filter === f.id ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
        {!log && !error && <p className="px-6 pb-6 text-sm text-muted-foreground">Carregando…</p>}
        {log && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>Entrada</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Visitante</TableHead>
                  <TableHead className="w-32">Rolagem</TableHead>
                  <TableHead>Parou em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma visita {filter === 'all' ? 'no período' : 'com esse filtro'}.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((v) => {
                    const open = openId === v.id;
                    const clicks = clickCount(v);
                    return (
                      <Fragment key={v.id}>
                        <TableRow className="cursor-pointer" onClick={() => setOpenId(open ? null : v.id)}>
                          <TableCell className="pr-0">
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            <span className="flex items-center gap-1.5">
                              {timeFmt.format(new Date(v.started_at))}
                              {isLive(v) && <span className="h-2 w-2 rounded-full bg-green-500" title="Na página agora" />}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {formatSeconds(secondsBetween(v.started_at, v.last_seen_at))}
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <p className="truncate">{sourceOf(v)}</p>
                            {v.utm_campaign && <p className="truncate text-xs text-muted-foreground">{v.utm_campaign}</p>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-sm">
                              {v.device === 'desktop' ? (
                                <Monitor className="h-4 w-4 text-muted-foreground" aria-label="Computador" />
                              ) : (
                                <Smartphone className="h-4 w-4 text-muted-foreground" aria-label="Celular" />
                              )}
                              {v.visit_number > 1 ? `${v.visit_number}ª visita` : 'Nova'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {v.max_scroll_pct > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 rounded-full bg-muted overflow-hidden" aria-hidden>
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${v.max_scroll_pct}%` }} />
                                </div>
                                <span className="text-xs tabular-nums text-muted-foreground">{v.max_scroll_pct}%</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{sectionLabel(v.current_section)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {clicks > 0 && (
                                <Badge variant="secondary" className="gap-1 font-normal">
                                  <MousePointerClick className="h-3 w-3" /> {clicks}
                                </Badge>
                              )}
                              {v.conversation && <Badge variant="secondary" className="font-normal">Conversa</Badge>}
                              {v.conversation?.whatsapp && <Badge className="font-normal">WhatsApp</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={8} className="bg-muted/30">
                              <VisitDetail visit={v} clockFmt={clockFmt} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {log.total > log.sessions.length && (
              <p className="px-6 py-3 text-xs text-muted-foreground">
                Mostrando as {log.sessions.length} visitas mais recentes de {log.total}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VisitDetail({ visit: v, clockFmt }: { visit: LandingVisitLogEntry; clockFmt: Intl.DateTimeFormat }) {
  const start = new Date(v.started_at).getTime();
  const at = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - start) / 1000));
  const events = [...v.events].sort((a, b) => a.at.localeCompare(b.at));
  const endIso = v.ended_at ?? v.last_seen_at;

  const sectionTimes = Object.entries(v.section_seconds ?? {}).sort(([a], [b]) => {
    const ia = SECTION_ORDER.indexOf(a);
    const ib = SECTION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const maxSecs = Math.max(1, ...sectionTimes.map(([, s]) => s));

  return (
    <div className="grid gap-6 md:grid-cols-2 py-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">Linha do tempo</p>
        <ol className="space-y-1.5 text-sm">
          <li className="flex gap-3">
            <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{clockFmt.format(new Date(v.started_at))}</span>
            <span>Entrou{v.current_path ? ` em ${v.current_path}` : ''}</span>
          </li>
          {events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-16 shrink-0 tabular-nums text-muted-foreground" title={clockFmt.format(new Date(e.at))}>
                {offsetLabel(at(e.at))}
              </span>
              <span>
                {e.k === 'section' ? (
                  <>Chegou em <strong className="font-medium">{sectionLabel(e.l)}</strong></>
                ) : (
                  <>Clicou em <strong className="font-medium">“{e.l}”</strong></>
                )}
              </span>
            </li>
          ))}
          <li className="flex gap-3">
            <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{clockFmt.format(new Date(endIso))}</span>
            <span>{v.ended_at ? 'Saiu da página' : isLive(v) ? 'Ainda na página' : 'Último sinal'}</span>
          </li>
        </ol>
        {events.length === 0 && (
          <p className="text-xs text-muted-foreground">Sem cliques ou seções registrados nesta visita.</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Tempo em cada seção</p>
          {sectionTimes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {v.sections_seen.length > 0
                ? `Seções vistas: ${v.sections_seen.map((s) => sectionLabel(s)).join(' → ')}.`
                : 'Sem dados de seção.'}
            </p>
          ) : (
            sectionTimes.map(([s, secs]) => (
              <div key={s} className="grid grid-cols-[120px_1fr_56px] items-center gap-2 text-sm">
                <span className="truncate">{sectionLabel(s)}</span>
                <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(secs / maxSecs) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums text-muted-foreground">{formatSeconds(secs)}</span>
              </div>
            ))
          )}
        </div>

        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Origem</dt>
          <dd className="break-all">
            {sourceOf(v)}
            {v.utm_medium && ` / ${v.utm_medium}`}
          </dd>
          {v.utm_campaign && (
            <>
              <dt className="text-muted-foreground">Campanha</dt>
              <dd className="break-all">{v.utm_campaign}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Rolagem máxima</dt>
          <dd>{v.max_scroll_pct > 0 ? `${v.max_scroll_pct}% da página` : '—'}</dd>
          <dt className="text-muted-foreground">Visitante</dt>
          <dd className="font-mono">{v.visitor_id.slice(0, 8)}</dd>
          {v.conversation && (
            <>
              <dt className="text-muted-foreground">Conversa</dt>
              <dd>
                <Link to={`/admin/live-chat?c=${v.conversation.id}`} className="underline" onClick={(e) => e.stopPropagation()}>
                  Abrir conversa
                </Link>
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
