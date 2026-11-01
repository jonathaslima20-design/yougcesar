import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { AlarmClock, ArrowLeft, Ban, Maximize2, BarChart3, Bell, BellOff, CheckCheck, Copy, Download, MessageCircle, MessageSquareText, RotateCcw, Send, Settings, Trash2, Volume2, VolumeX } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { isLiveChatSoundEnabled, notifyLiveChatRead, playLiveChatChime, setLiveChatSoundEnabled } from '@/hooks/useLiveChatUnreadCount';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  blockVisitor,
  describeStatus,
  exportWhatsappLeadsCsv,
  fetchAdminStatus,
  fetchCannedReplies,
  setConversationContacted,
  STATE_LABELS,
  updateLiveChatSettings,
  deleteConversation,
  fetchConversations,
  fetchLiveChatSettings,
  fetchMessages,
  fetchVisitorSession,
  markConversationRead,
  sendOperatorMessage,
  setConversationStatus,
  subscribeAdminLiveChat,
  type ConversationListItem,
} from '@/lib/liveChat/adminService';
import { formatClock, formatDuration, formatPhoneBR, sectionLabel, whatsappLink } from '@/lib/liveChat/format';
import type { AdminChatMessageRow, CannedReply, LiveChatAdminStatus, VisitorSessionRow } from '@/lib/liveChat/types';
import { cn } from '@/lib/utils';

const FALLBACK_POLL_MS = 30_000;
const TYPING_SHOW_MS = 4000;
const TYPING_THROTTLE_MS = 2000;
const PHONE_PREVIEW = /^\+\d{12,13}$/;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <Badge variant="outline" className="border-[#25D366] text-[#128C7E]">Aguardando contato</Badge>;
  if (status === 'closed') return <Badge variant="secondary">Encerrada</Badge>;
  return <Badge variant="outline">Aberta</Badge>;
}

export default function LiveChatInboxPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('c');

  const [scope, setScope] = useState<'active' | 'closed'>('active');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminChatMessageRow[]>([]);
  const [session, setSession] = useState<VisitorSessionRow | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [typingEnabled, setTypingEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<LiveChatAdminStatus | null>(null);
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [unansweredMinutes, setUnansweredMinutes] = useState(5);
  const [soundOn, setSoundOn] = useState(isLiveChatSoundEnabled);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  );
  const [clock, setClock] = useState(Date.now());
  const [showDetails, setShowDetails] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingSent = useRef(0);
  const selectedRef = useRef<string | null>(selectedId);
  selectedRef.current = selectedId;

  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

  const loadList = useCallback(async () => {
    try {
      setConversations(await fetchConversations(scope));
      setListError(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Erro ao carregar conversas');
    } finally {
      setLoadingList(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchLiveChatSettings()
      .then((s) => {
        setTypingEnabled(s.typing_indicator_enabled);
        setChatEnabled(s.chat_enabled);
        setUnansweredMinutes(s.unanswered_alert_minutes ?? 5);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoadingList(true);
    loadList();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') loadList();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(poll);
  }, [loadList]);

  // eventos em tempo real do canal privado do admin
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeAdminLiveChat((evt) => {
      if (evt.type === 'message' && evt.conversation_id === selectedRef.current) {
        setMessages((cur) => (cur.some((m) => m.id === evt.message.id) ? cur : [...cur, { ...evt.message, conversation_id: evt.conversation_id, admin_user_id: null }]));
        if (evt.message.sender === 'visitor') {
          setVisitorTyping(false);
          markConversationRead(evt.conversation_id).catch(() => undefined);
        }
      }
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(loadList, 300);
    });
    return () => {
      clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [loadList]);

  // conversa selecionada: histórico, sessão, leitura
  useEffect(() => {
    setMessages([]);
    setSession(null);
    setVisitorTyping(false);
    if (!selectedId) return;
    let active = true;
    fetchMessages(selectedId)
      .then((m) => active && setMessages(m))
      .catch(() => toast.error('Erro ao carregar mensagens'));
    markConversationRead(selectedId)
      .then(() => {
        notifyLiveChatRead();
        if (active) setConversations((cur) => cur.map((c) => (c.id === selectedId ? { ...c, unread_for_admin: 0 } : c)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selected?.session_id) return;
    let active = true;
    fetchVisitorSession(selected.session_id).then((s) => active && setSession(s)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selected?.session_id]);

  // canal público da conversa: "digitando…" nos dois sentidos e abrir à força
  const channelKey = selected?.channel_key;
  useEffect(() => {
    if (!channelKey) return;
    const channel = supabase
      .channel(`chat:${channelKey}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!typingEnabled || payload?.from !== 'visitor') return;
        setVisitorTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setVisitorTyping(false), TYPING_SHOW_MS);
      })
      .subscribe();
    typingChannel.current = channel;
    return () => {
      clearTimeout(typingTimer.current);
      supabase.removeChannel(channel);
      typingChannel.current = null;
    };
  }, [channelKey, typingEnabled]);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  }, [messages.length, visitorTyping]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('c', id);
    else next.delete('c');
    setSearchParams(next, { replace: true });
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !selectedId || !user?.id || sending) return;
    setSending(true);
    try {
      await sendOperatorMessage(selectedId, user.id, text);
      setDraft('');
      setMessages(await fetchMessages(selectedId));
    } catch (err) {
      toast.error('Erro ao enviar mensagem');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const forceOpen = async () => {
    const channel = typingChannel.current;
    if (!channel) return;
    const res = await channel.send({ type: 'broadcast', event: 'force_open', payload: {} });
    if (res === 'ok') toast.success('Pedido enviado: a conversa abre na tela do visitante se ele estiver com a página aberta.');
    else toast.error('Não foi possível enviar agora. Tente de novo.');
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!typingChannel.current || !typingEnabled) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    typingChannel.current.send({ type: 'broadcast', event: 'typing', payload: { from: 'operator' } });
  };

  const changeStatus = async (status: 'open' | 'closed') => {
    if (!selectedId) return;
    try {
      await setConversationStatus(selectedId, status);
      notifyLiveChatRead();
      if (status === 'closed' && scope === 'active') select(null);
      loadList();
    } catch {
      toast.error('Erro ao atualizar conversa');
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    if (!window.confirm('Apagar definitivamente esta conversa e o número de WhatsApp (pedido LGPD)?')) return;
    try {
      await deleteConversation(selectedId);
      notifyLiveChatRead();
      select(null);
      loadList();
      toast.success('Conversa apagada');
    } catch {
      toast.error('Erro ao apagar conversa');
    }
  };

  useEffect(() => {
    fetchCannedReplies().then(setCanned).catch(() => undefined);
    const loadStatus = () => fetchAdminStatus().then(setStatus).catch(() => undefined);
    loadStatus();
    const s = setInterval(loadStatus, 30_000);
    const c = setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      clearInterval(s);
      clearInterval(c);
    };
  }, []);

  const toggleAvailable = async (available: boolean) => {
    try {
      await updateLiveChatSettings({ admin_available: available });
      setStatus(await fetchAdminStatus());
      toast.success(available ? 'Você está disponível' : 'Você está ausente');
    } catch {
      toast.error('Não foi possível alterar a disponibilidade');
    }
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') toast.success('Notificações ativadas');
    else toast.error('O navegador bloqueou as notificações. Libere nas configurações do site.');
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setLiveChatSoundEnabled(next);
    if (next) playLiveChatChime();
  };

  const exportCsv = async () => {
    try {
      const n = await exportWhatsappLeadsCsv();
      toast.success(n ? `${n} lead(s) exportado(s)` : 'Nenhum lead com WhatsApp ainda');
    } catch {
      toast.error('Erro ao exportar');
    }
  };

  const toggleContacted = async () => {
    if (!selected) return;
    try {
      await setConversationContacted(selected.id, !selected.contacted_at);
      loadList();
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const block = async () => {
    if (!selected || !user?.id) return;
    const reason = window.prompt('Bloquear este visitante? Ele não verá mais o chat. Motivo (opcional):');
    if (reason === null) return;
    try {
      await blockVisitor(selected.visitor_id, user.id, reason.trim() || null, selected.id);
      notifyLiveChatRead();
      toast.success('Visitante bloqueado');
      select(null);
      loadList();
    } catch {
      toast.error('Erro ao bloquear');
    }
  };

  const isUnanswered = (c: ConversationListItem) =>
    c.status !== 'closed' &&
    c.last_message_sender === 'visitor' &&
    clock - new Date(c.last_message_at).getTime() > unansweredMinutes * 60_000;

  const operatorName = selected?.operator?.display_name;
  const waText = `Olá! Aqui é ${operatorName ?? 'a equipe'} da VitrineTurbo, continuando nossa conversa do site. Como posso te ajudar?`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Atendimento</h1>
          <p className="text-sm text-muted-foreground">Conversas do chat da landing page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border px-3 h-9">
            <span className={cn('w-2 h-2 rounded-full', status?.operator_online ? 'bg-emerald-500' : 'bg-amber-500')} />
            <span className="text-sm">{status?.admin_available === false ? 'Ausente' : 'Disponível'}</span>
            <Switch checked={status?.admin_available !== false} onCheckedChange={toggleAvailable} aria-label="Disponível" />
          </div>
          {notifPermission !== 'unsupported' && notifPermission !== 'granted' && (
            <Button variant="outline" size="sm" onClick={enableNotifications}><Bell className="h-4 w-4 mr-1" /> Ativar notificações</Button>
          )}
          {notifPermission === 'denied' && <BellOff className="h-4 w-4 text-muted-foreground" aria-label="Notificações bloqueadas" />}
          <Button variant="outline" size="icon" onClick={toggleSound} aria-label={soundOn ? 'Desligar som' : 'Ligar som'} title={soundOn ? 'Som ligado' : 'Som desligado'}>
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Leads CSV</Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/live-chat/metrics"><BarChart3 className="h-4 w-4 mr-1" /> Métricas</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/live-visitors">Ao vivo</Link></Button>
          <Button asChild variant="outline" size="icon" aria-label="Configurações"><Link to="/admin/live-chat/settings"><Settings className="h-4 w-4" /></Link></Button>
        </div>
      </div>

      {status && status.state !== 'online' && status.state !== 'off' && (
        <p className="text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
          <strong>{STATE_LABELS[status.state]}.</strong> {describeStatus(status)}
        </p>
      )}
      {status && status.active_operators === 0 && (
        <p className="text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
          Nenhum operador ativo: o chat aparece com a persona padrão.{' '}
          <Link to="/admin/live-chat/operators" className="underline font-medium">Cadastrar operador</Link>
        </p>
      )}

      {chatEnabled === false && (
        <p className="text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
          O chat está desligado: visitantes não veem o pop-up. Ative em{' '}
          <Link to="/admin/live-chat/settings" className="underline font-medium">Configurações</Link>.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_280px] border rounded-xl overflow-hidden bg-background h-[calc(100vh-13rem)] min-h-[520px]">
        {/* fila */}
        <aside className={cn('border-r flex flex-col min-h-0', selectedId && 'hidden lg:flex')}>
          <div className="flex border-b">
            {(['active', 'closed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn('flex-1 py-2.5 text-sm', scope === s ? 'font-semibold border-b-2 border-foreground' : 'text-muted-foreground')}
              >
                {s === 'active' ? 'Em andamento' : 'Encerradas'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {listError && <p className="p-3 text-xs text-destructive">{listError}</p>}
            {loadingList ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa {scope === 'active' ? 'em andamento' : 'encerrada'}.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b hover:bg-muted/50 flex gap-3',
                    isUnanswered(c) && 'bg-red-50 dark:bg-red-950/30',
                    c.id === selectedId && 'bg-muted',
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-mono shrink-0">
                    {c.visitor_id.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm truncate', c.unread_for_admin > 0 && 'font-semibold')}>
                        {c.whatsapp_e164 ? formatPhoneBR(c.whatsapp_e164) : `Visitante #${c.visitor_id.slice(0, 6)}`}
                      </p>
                      <span className={cn('text-[11px] shrink-0 flex items-center gap-1', isUnanswered(c) ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                        {isUnanswered(c) && <AlarmClock className="h-3 w-3" />}
                        {relativeTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {c.last_message_sender === 'operator' && 'Você: '}
                        {c.last_message_preview && PHONE_PREVIEW.test(c.last_message_preview)
                          ? '📱 Informou o WhatsApp'
                          : c.last_message_preview ?? '—'}
                      </p>
                      {c.unread_for_admin > 0 ? (
                        <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center shrink-0">
                          {c.unread_for_admin}
                        </span>
                      ) : c.status === 'pending' && !c.contacted_at ? (
                        <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0" title="Aguardando contato no WhatsApp" />
                      ) : c.contacted_at ? (
                        <CheckCheck className="h-3.5 w-3.5 text-[#128C7E] shrink-0" aria-label="Contatado" />
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* conversa */}
        <section className={cn('flex flex-col min-h-0', !selectedId && 'hidden lg:flex')}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MessageCircle className="h-8 w-8" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => select(null)} aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9">
                  {selected.operator?.avatar_url && <AvatarImage src={selected.operator.avatar_url} alt="" />}
                  <AvatarFallback>{operatorName?.charAt(0) ?? 'V'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Visitante #{selected.visitor_id.slice(0, 6)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {visitorTyping
                      ? 'digitando…'
                      : `${selected.started_by === 'operator' ? 'iniciada por você · ' : ''}respondendo como ${operatorName ?? 'persona padrão'}`}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
                {selected.status !== 'closed' && (
                  <Button variant="outline" size="sm" onClick={forceOpen} title="Abre a janela do chat na tela do visitante">
                    <Maximize2 className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Abrir no visitante</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="xl:hidden" onClick={() => setShowDetails(true)}>
                  Detalhes
                </Button>
                {selected.whatsapp_e164 && (
                  <Button asChild size="sm" className="xl:hidden bg-[#25D366] hover:bg-[#1ebe5a] text-white">
                    <a href={whatsappLink(selected.whatsapp_e164, waText)} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </Button>
                )}
                {selected.status === 'closed' ? (
                  <Button variant="outline" size="sm" onClick={() => changeStatus('open')}><RotateCcw className="h-4 w-4 mr-1" /> Reabrir</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => changeStatus('closed')}><CheckCheck className="h-4 w-4 mr-1" /> Encerrar</Button>
                )}
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
                {messages.map((m) => {
                  const mine = m.sender !== 'visitor';
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                          m.kind === 'whatsapp'
                            ? 'bg-[#25D366]/15 border border-[#25D366] text-foreground'
                            : mine
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-background border rounded-bl-md',
                          m.sender === 'system' && 'opacity-80 italic',
                        )}
                      >
                        {m.sender === 'system' && <span className="block text-[10px] not-italic opacity-70 mb-0.5">Saudação automática</span>}
                        {m.kind === 'whatsapp' ? (
                          <span>📱 Visitante informou o WhatsApp: <strong>{formatPhoneBR(m.body)}</strong></span>
                        ) : (
                          m.body
                        )}
                        <span className="block text-[10px] mt-1 text-right opacity-70">{formatClock(m.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                {visitorTyping && (
                  <div className="flex justify-start">
                    <div className="bg-background border rounded-2xl rounded-bl-md px-3 py-2 text-xs text-muted-foreground">digitando…</div>
                  </div>
                )}
              </div>

              <form
                className="border-t p-3 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={draft}
                  placeholder={`Responder como ${operatorName ?? 'VitrineTurbo'}… (Enter envia, Shift+Enter quebra linha)`}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  className="resize-none"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" aria-label="Respostas prontas" title="Respostas prontas">
                      <MessageSquareText className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
                    {canned.length === 0 ? (
                      <DropdownMenuItem asChild>
                        <Link to="/admin/live-chat/settings">Cadastrar respostas prontas</Link>
                      </DropdownMenuItem>
                    ) : (
                      canned.map((r) => (
                        <DropdownMenuItem key={r.id} onSelect={() => onDraftChange(draft ? `${draft} ${r.body}` : r.body)} className="flex-col items-start">
                          <span className="font-medium text-sm">{r.title}</span>
                          <span className="text-xs text-muted-foreground line-clamp-2">{r.body}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button type="submit" disabled={sending || !draft.trim()} size="icon" aria-label="Enviar">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </section>

        {/* painel do lead */}
        {showDetails && <div className="xl:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setShowDetails(false)} />}
        <aside
          className={cn(
            'border-l flex-col min-w-0 overflow-y-auto p-4 gap-4 text-sm bg-background',
            showDetails ? 'flex fixed inset-y-0 right-0 z-50 w-80 shadow-xl xl:static xl:w-auto xl:shadow-none xl:z-auto' : 'hidden xl:flex',
          )}
        >
          <Button variant="ghost" size="sm" className="xl:hidden self-end" onClick={() => setShowDetails(false)}>
            Fechar
          </Button>
          {!selected ? (
            <p className="text-muted-foreground">Os dados do visitante aparecem aqui.</p>
          ) : (
            <>
              {selected.whatsapp_e164 ? (
                <div className="rounded-lg border border-[#25D366] bg-[#25D366]/10 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">WhatsApp do visitante</p>
                  <p className="text-lg font-semibold">{formatPhoneBR(selected.whatsapp_e164)}</p>
                  <Button asChild className="w-full bg-[#25D366] hover:bg-[#1ebe5a] text-white">
                    <a href={whatsappLink(selected.whatsapp_e164, waText)} target="_blank" rel="noopener noreferrer">
                      Abrir no WhatsApp
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(selected.whatsapp_e164!).then(() => toast.success('Número copiado'));
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" /> Copiar número
                  </Button>
                  <label className="flex items-center justify-between gap-2 text-xs pt-1">
                    <span>{selected.contacted_at ? `Contatado em ${new Date(selected.contacted_at).toLocaleString('pt-BR')}` : 'Já chamei no WhatsApp'}</span>
                    <Switch checked={!!selected.contacted_at} onCheckedChange={toggleContacted} />
                  </label>
                  {selected.whatsapp_consent_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Consentimento em {new Date(selected.whatsapp_consent_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground rounded-lg border p-3">O visitante ainda não informou WhatsApp.</p>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Navegação</p>
                {session ? (
                  <dl className="space-y-1.5">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Seção atual</dt><dd>{sectionLabel(session.current_section)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Na sessão há</dt><dd>{formatDuration(session.started_at, new Date(session.last_seen_at).getTime())}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Visto por último</dt><dd>{relativeTime(session.last_seen_at)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Visita</dt><dd>{session.visit_number}ª</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Dispositivo</dt><dd>{session.device ?? '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Origem</dt><dd className="truncate">{session.utm_source ?? session.referrer_host ?? 'Direto'}</dd></div>
                    {session.utm_campaign && (
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Campanha</dt><dd className="truncate">{session.utm_campaign}</dd></div>
                    )}
                    {session.sections_seen.length > 0 && (
                      <div>
                        <dt className="text-muted-foreground">Seções vistas</dt>
                        <dd className="text-xs mt-1">{session.sections_seen.map(sectionLabel).join(' → ')}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem dados de navegação (sessão expirada ou monitoramento desligado).</p>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Início: {new Date(selected.created_at).toLocaleString('pt-BR')}</p>
                <p>Persona: {operatorName ?? 'persona padrão'}</p>
                {selected.source && <p>Origem: {selected.source}{selected.utm_campaign ? ` / ${selected.utm_campaign}` : ''}</p>}
              </div>

              <Button variant="ghost" size="sm" className="justify-start mt-auto" onClick={block}>
                <Ban className="h-4 w-4 mr-1" /> Bloquear visitante
              </Button>

              <Button variant="ghost" size="sm" className="text-destructive justify-start" onClick={remove}>
                <Trash2 className="h-4 w-4 mr-1" /> Apagar conversa (LGPD)
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
