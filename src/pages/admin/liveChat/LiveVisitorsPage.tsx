import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Smartphone, MessageCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchLiveChatSettings, fetchLiveVisitors, type LiveVisitor } from '@/lib/liveChat/adminService';
import { formatDuration, sectionLabel } from '@/lib/liveChat/format';

const POLL_MS = 10_000;
const ACTIVE_SECONDS = 60;

type VisitorStatus = 'active' | 'idle';

function statusOf(v: LiveVisitor, now: number): VisitorStatus {
  return now - new Date(v.last_interaction_at).getTime() < ACTIVE_SECONDS * 1000 ? 'active' : 'idle';
}

function origin(v: LiveVisitor): string {
  if (v.utm_source) return [v.utm_source, v.utm_medium, v.utm_campaign].filter(Boolean).join(' / ');
  return v.referrer_host ?? 'Direto';
}

export default function LiveVisitorsPage() {
  const [visitors, setVisitors] = useState<LiveVisitor[]>([]);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    try {
      setVisitors(await fetchLiveVisitors());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  };

  useEffect(() => {
    fetchLiveChatSettings()
      .then((s) => setTrackingEnabled(s.tracking_enabled))
      .catch(() => setTrackingEnabled(null));
    load();
    // polling barato: 1 consulta a cada 10 s, só com a aba do admin visível
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  const active = visitors.filter((v) => statusOf(v, now) === 'active').length;
  const inChat = visitors.filter((v) => v.conversations.some((c) => c.status !== 'closed')).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Visitantes ao vivo</h1>
          <p className="text-sm text-muted-foreground">
            Quem está na landing page agora. Atualiza a cada 10 s; cada visitante envia sinal a cada 30 s.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {trackingEnabled === false && (
        <p className="text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
          O monitoramento está desligado. Ative em{' '}
          <Link to="/admin/live-chat/settings" className="underline font-medium">Configurações do Atendimento</Link>.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground font-normal">Na página agora</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{visitors.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground font-normal">Ativos (interagiram há &lt; 1 min)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{active}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground font-normal">Em conversa</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{inChat}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitante</TableHead>
                <TableHead>Seção atual</TableHead>
                <TableHead>Tempo na sessão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead className="text-right">Chat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Carregando…</TableCell></TableRow>
              ) : visitors.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Nenhum visitante na landing no momento.</TableCell></TableRow>
              ) : (
                visitors.map((v) => {
                  const st = statusOf(v, now);
                  const openConv = v.conversations.find((c) => c.status !== 'closed');
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {v.device === 'mobile' ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Monitor className="h-4 w-4 text-muted-foreground" />}
                          <div>
                            <p className="font-mono text-xs">#{v.visitor_id.slice(0, 6)}</p>
                            <p className="text-xs text-muted-foreground">{v.visit_number}ª visita</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{sectionLabel(v.current_section)}</p>
                        {v.sections_seen.length > 1 && (
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]" title={v.sections_seen.map(sectionLabel).join(' → ')}>
                            viu: {v.sections_seen.map(sectionLabel).join(', ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{formatDuration(v.started_at, now)}</TableCell>
                      <TableCell>
                        <Badge variant={st === 'active' ? 'default' : 'secondary'} className={st === 'active' ? 'bg-emerald-600 hover:bg-emerald-600' : ''}>
                          {st === 'active' ? 'Ativo' : `Inativo há ${formatDuration(v.last_interaction_at, now)}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={origin(v)}>{origin(v)}</TableCell>
                      <TableCell className="text-sm">{v.operator?.display_name ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {openConv ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/admin/live-chat?c=${openConv.id}`}>
                              <MessageCircle className="h-4 w-4 mr-1" /> Abrir
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
