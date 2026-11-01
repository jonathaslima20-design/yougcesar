import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Monitor, Smartphone, MessageCircle, RefreshCw, MessageSquarePlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchLiveChatSettings, fetchLiveVisitors, startConversation, type LiveVisitor } from '@/lib/liveChat/adminService';
import { formatDuration, sectionLabel } from '@/lib/liveChat/format';

const POLL_MS = 10_000;
const ACTIVE_SECONDS = 60;

type VisitorStatus = 'active' | 'idle';

function statusOf(v: LiveVisitor, now: number): VisitorStatus {
  return now - new Date(v.last_interaction_at).getTime() < ACTIVE_SECONDS * 1000 ? 'active' : 'idle';
}

function openingMessage(v: LiveVisitor): string {
  // já viu a saudação automática: continua a conversa em vez de se apresentar de novo
  if (v.greeting_shown_at) {
    if (v.current_section === 'precos') return 'Vi que você está olhando os planos 🙂 Quer ajuda para escolher o ideal para a sua loja?';
    if (v.current_section === 'faq') return 'Ficou alguma dúvida que eu possa responder? 🙂';
    return 'Vi que você ainda está por aqui 🙂 Posso te ajudar com alguma dúvida?';
  }
  const name = v.operator?.display_name;
  const intro = name ? `Oi! Aqui é ${name}, da VitrineTurbo.` : 'Oi! Aqui é da equipe VitrineTurbo.';
  if (v.current_section === 'precos') return `${intro} Vi que você está olhando os planos. Posso te ajudar a escolher o ideal para a sua loja?`;
  if (v.current_section === 'faq') return `${intro} Ficou alguma dúvida que eu possa responder?`;
  return `${intro} Posso te ajudar a montar sua loja online?`;
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
  const [target, setTarget] = useState<LiveVisitor | null>(null);
  const [opening, setOpening] = useState('');
  const [starting, setStarting] = useState(false);
  const [forceOpenChat, setForceOpenChat] = useState(false);
  const navigate = useNavigate();

  const openStart = (v: LiveVisitor) => {
    setTarget(v);
    setOpening(openingMessage(v));
  };

  const start = async () => {
    if (!target || !opening.trim()) return;
    setStarting(true);
    try {
      const res = await startConversation(target.id, opening, forceOpenChat);
      toast.success(res.existing ? 'Esse visitante já tem uma conversa aberta' : 'Mensagem enviada. O visitante vê em até 30 s.');
      setTarget(null);
      navigate(`/admin/live-chat?c=${res.conversation_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg.includes('session_not_found') ? 'O visitante saiu da página.' : msg.includes('blocked') ? 'Visitante bloqueado.' : 'Não foi possível iniciar a conversa.');
    } finally {
      setStarting(false);
    }
  };

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
                          <Button size="sm" variant="ghost" onClick={() => openStart(v)} disabled={!trackingEnabled}>
                            <MessageSquarePlus className="h-4 w-4 mr-1" /> Iniciar
                          </Button>
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

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar conversa</DialogTitle>
            <DialogDescription>
              O visitante #{target?.visitor_id.slice(0, 6)} recebe o balão do chat com esta mensagem em até 30 segundos, se continuar na
              página com a aba aberta.
              {target?.greeting_shown_at && ' Ele já viu a saudação automática: ela fica no início da conversa e esta mensagem vem em seguida.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={4} maxLength={2000} value={opening} onChange={(e) => setOpening(e.target.value)} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={forceOpenChat} onChange={(e) => setForceOpenChat(e.target.checked)} />
            <span>
              Abrir a janela do chat na tela do visitante
              <span className="block text-xs text-muted-foreground">
                Desmarcado: aparece o balão com a mensagem, ou só o número no botão se ele já tinha fechado o chat.
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button onClick={start} disabled={starting || !opening.trim()}>
              {starting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
