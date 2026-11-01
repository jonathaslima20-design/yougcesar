import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Ban,
  Clock,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  deleteCannedReply,
  describeStatus,
  fetchAdminStatus,
  fetchBlockedVisitors,
  fetchCannedReplies,
  fetchLiveChatSettings,
  runCleanupNow,
  saveCannedReply,
  STATE_LABELS,
  unblockVisitor,
  updateLiveChatSettings,
  uploadOperatorAvatar,
  type BlockedVisitor,
} from '@/lib/liveChat/adminService';
import { LANDING_SECTION_LABELS } from '@/lib/liveChat/format';
import type { CannedReply, LiveChatAdminStatus, LiveChatSettings } from '@/lib/liveChat/types';
import { cn } from '@/lib/utils';

const DAYS = [
  { key: '1', label: 'Segunda' },
  { key: '2', label: 'Terça' },
  { key: '3', label: 'Quarta' },
  { key: '4', label: 'Quinta' },
  { key: '5', label: 'Sexta' },
  { key: '6', label: 'Sábado' },
  { key: '0', label: 'Domingo' },
];

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Cuiaba',
  'America/Rio_Branco',
  'America/Noronha',
];

// chaves que salvam no clique (não entram no "alterações não salvas")
const INSTANT_KEYS = ['chat_enabled', 'tracking_enabled', 'typing_indicator_enabled', 'admin_available', 'paused_until'] as const;
type InstantKey = (typeof INSTANT_KEYS)[number];

const STATE_STYLES: Record<LiveChatAdminStatus['state'], string> = {
  online: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  away: 'bg-amber-500 hover:bg-amber-500 text-white',
  paused: 'bg-amber-500 hover:bg-amber-500 text-white',
  holiday: 'bg-slate-500 hover:bg-slate-500 text-white',
  closed_hours: 'bg-slate-500 hover:bg-slate-500 text-white',
  off: 'bg-slate-300 hover:bg-slate-300 text-slate-800',
};

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  busy,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <Switch checked={checked} onCheckedChange={onChange} disabled={busy} />
      </div>
    </div>
  );
}

function editableSnapshot(s: LiveChatSettings, quickReplies: string) {
  const rest: Record<string, unknown> = { ...s };
  for (const k of INSTANT_KEYS) delete rest[k];
  delete rest.updated_at;
  delete rest.admin_last_seen_at;
  return JSON.stringify({ ...rest, quick_replies: quickReplies });
}

export default function LiveChatSettingsPage() {
  const [settings, setSettings] = useState<LiveChatSettings | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [status, setStatus] = useState<LiveChatAdminStatus | null>(null);
  const [quickRepliesText, setQuickRepliesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [instantBusy, setInstantBusy] = useState<InstantKey | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState('');
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [cannedDraft, setCannedDraft] = useState<{ id?: string; title: string; body: string } | null>(null);
  const [blocked, setBlocked] = useState<BlockedVisitor[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshStatus = useCallback(() => {
    fetchAdminStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    fetchLiveChatSettings()
      .then((s) => {
        const qr = (s.quick_replies ?? []).join('\n');
        setSettings(s);
        setQuickRepliesText(qr);
        setSavedSnapshot(editableSnapshot(s, qr));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar'));
    refreshStatus();
    fetchCannedReplies().then(setCanned).catch(() => undefined);
    fetchBlockedVisitors().then(setBlocked).catch(() => undefined);
    const t = setInterval(refreshStatus, 30_000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  const dirty = useMemo(
    () => !!settings && editableSnapshot(settings, quickRepliesText) !== savedSnapshot,
    [settings, quickRepliesText, savedSnapshot],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loadError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-sm text-destructive">
          Não foi possível carregar as configurações do chat ({loadError}). As migrations do chat já foram aplicadas?
        </p>
      </div>
    );
  }

  if (!settings) {
    return <div className="h-96 flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  const set = <K extends keyof LiveChatSettings>(key: K, value: LiveChatSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const setDay = (day: string, patch: Partial<LiveChatSettings['business_hours'][string]>) =>
    setSettings((s) =>
      s ? { ...s, business_hours: { ...s.business_hours, [day]: { ...s.business_hours[day], ...patch } } } : s,
    );

  // salva na hora uma chave liga/desliga (sem esperar o botão Salvar)
  const saveInstant = async <K extends InstantKey>(key: K, value: LiveChatSettings[K], okMessage: string) => {
    const previous = settings[key];
    set(key, value);
    setInstantBusy(key);
    try {
      await updateLiveChatSettings({ [key]: value } as Partial<LiveChatSettings>);
      toast.success(okMessage);
      refreshStatus();
    } catch {
      set(key, previous);
      toast.error('Não foi possível salvar. Tente de novo.');
    } finally {
      setInstantBusy(null);
    }
  };

  const pauseFor = (hours: number | 'tomorrow') => {
    let until: Date;
    if (hours === 'tomorrow') {
      until = new Date();
      until.setDate(until.getDate() + 1);
      until.setHours(8, 0, 0, 0);
    } else {
      until = new Date(Date.now() + hours * 3_600_000);
    }
    saveInstant('paused_until', until.toISOString(), `Chat pausado até ${until.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`);
  };

  const save = async () => {
    for (const d of DAYS) {
      const h = settings.business_hours[d.key];
      if (h?.enabled && h.start >= h.end) {
        toast.error(`${d.label}: o horário de início precisa ser antes do fim.`);
        return;
      }
    }
    setSaving(true);
    try {
      const quick = quickRepliesText
        .split('\n')
        .map((q) => q.trim())
        .filter(Boolean)
        .slice(0, 6);
      const payload: Record<string, unknown> = { ...settings, quick_replies: quick };
      for (const k of [...INSTANT_KEYS, 'id', 'updated_at', 'admin_last_seen_at']) delete payload[k];
      await updateLiveChatSettings(payload as Partial<LiveChatSettings>);
      const qr = quick.join('\n');
      setQuickRepliesText(qr);
      setSavedSnapshot(editableSnapshot({ ...settings, quick_replies: quick }, qr));
      toast.success('Configurações salvas');
      refreshStatus();
    } catch (err) {
      toast.error('Erro ao salvar configurações');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const cleanup = async () => {
    if (!window.confirm('Apagar agora as sessões e conversas fora do prazo de retenção?')) return;
    setCleaning(true);
    try {
      await runCleanupNow();
      toast.success('Limpeza concluída');
    } catch {
      toast.error('Erro ao executar limpeza');
    } finally {
      setCleaning(false);
    }
  };

  const onFallbackAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/webp', 'image/png', 'image/jpeg'].includes(file.type) || file.size > 200 * 1024) {
      toast.error('Use WEBP, PNG ou JPG de até 200 KB.');
      return;
    }
    setUploading(true);
    try {
      set('fallback_avatar_url', await uploadOperatorAvatar(file));
    } catch {
      toast.error('Erro ao enviar a imagem');
    } finally {
      setUploading(false);
    }
  };

  const addHoliday = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) return;
    if (!settings.holidays.includes(newHoliday)) set('holidays', [...settings.holidays, newHoliday].sort());
    setNewHoliday('');
  };

  const saveCanned = async () => {
    if (!cannedDraft || !cannedDraft.title.trim() || !cannedDraft.body.trim()) {
      toast.error('Preencha título e texto.');
      return;
    }
    try {
      await saveCannedReply({ ...cannedDraft, sort_order: cannedDraft.id ? undefined : canned.length + 1 });
      setCannedDraft(null);
      setCanned(await fetchCannedReplies());
    } catch {
      toast.error('Erro ao salvar resposta pronta');
    }
  };

  const removeCanned = async (id: string) => {
    try {
      await deleteCannedReply(id);
      setCanned((c) => c.filter((r) => r.id !== id));
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const unblock = async (visitorId: string) => {
    try {
      await unblockVisitor(visitorId);
      setBlocked((b) => b.filter((v) => v.visitor_id !== visitorId));
      toast.success('Visitante desbloqueado');
    } catch {
      toast.error('Erro ao desbloquear');
    }
  };

  const isPaused = !!settings.paused_until && new Date(settings.paused_until) > new Date();

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl pb-24">
      <div>
        <h1 className="text-xl font-bold">Configurações do Atendimento</h1>
        <p className="text-sm text-muted-foreground">
          Chat com operador e monitoramento de visitantes da landing page. Tudo muda na hora, sem deploy.
        </p>
      </div>

      {/* status atual */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agora:</span>
                {status && <Badge className={STATE_STYLES[status.state]}>{STATE_LABELS[status.state]}</Badge>}
              </div>
              {status && <p className="text-sm text-muted-foreground">{describeStatus(status)}</p>}
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-sm">{settings.admin_available ? 'Disponível' : 'Ausente'}</span>
              <Switch
                checked={settings.admin_available}
                disabled={instantBusy === 'admin_available'}
                onCheckedChange={(v) => saveInstant('admin_available', v, v ? 'Você está disponível' : 'Você está ausente')}
              />
            </div>
          </div>

          {status && status.active_operators === 0 && (
            <p className="text-sm rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Nenhum operador ativo: o chat aparece como “{settings.fallback_operator_name}”.{' '}
                <Link to="/admin/live-chat/operators" className="underline font-medium">Cadastrar operador</Link>
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Pausar novas conversas:</span>
            {isPaused ? (
              <Button size="sm" variant="outline" onClick={() => saveInstant('paused_until', null, 'Chat retomado')}>
                <Play className="h-3.5 w-3.5 mr-1" /> Retomar agora
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => pauseFor(1)}><Pause className="h-3.5 w-3.5 mr-1" /> 1 h</Button>
                <Button size="sm" variant="outline" onClick={() => pauseFor(2)}>2 h</Button>
                <Button size="sm" variant="outline" onClick={() => pauseFor('tomorrow')}>Até amanhã 8h</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos em tempo real</CardTitle>
          <CardDescription>Estas chaves salvam no clique. Cada uma pode ser desligada para controlar custos no Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <ToggleRow
            icon={<MessageCircle className="h-5 w-5" />}
            title="Chat na landing page"
            description="Mostra o pop-up de atendimento para visitantes (respeitando horário, pausa e feriados)."
            checked={settings.chat_enabled}
            busy={instantBusy === 'chat_enabled'}
            onChange={(v) => saveInstant('chat_enabled', v, v ? 'Chat ligado' : 'Chat desligado')}
          />
          <ToggleRow
            icon={<Radio className="h-5 w-5" />}
            title="Monitoramento de visitantes ao vivo"
            description="Sinal a cada 30 s com a seção atual. Também é o que entrega conversas iniciadas por você."
            checked={settings.tracking_enabled}
            busy={instantBusy === 'tracking_enabled'}
            onChange={(v) => saveInstant('tracking_enabled', v, v ? 'Monitoramento ligado' : 'Monitoramento desligado')}
          />
          <ToggleRow
            icon={<span className="text-lg leading-none">…</span>}
            title='Indicador "digitando…"'
            description="Mostra quando o visitante ou o operador está digitando (só em conversas abertas)."
            checked={settings.typing_indicator_enabled}
            busy={instantBusy === 'typing_indicator_enabled'}
            onChange={(v) => saveInstant('typing_indicator_enabled', v, 'Preferência salva')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quando você estiver ausente</CardTitle>
          <CardDescription>
            Você fica ausente ao desligar “Disponível” ou quando nenhuma tela do admin fica aberta por 3 minutos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                ['ask_whatsapp', 'Pedir o WhatsApp', 'O chat continua aparecendo, avisa que a equipe não está online e pede o número.'],
                ['hide', 'Esconder o chat', 'Novos visitantes não veem o chat enquanto você estiver ausente.'],
              ] as const
            ).map(([value, title, desc]) => (
              <button
                key={value}
                type="button"
                onClick={() => set('away_behavior', value)}
                className={cn(
                  'text-left rounded-md border p-3',
                  settings.away_behavior === value ? 'border-foreground ring-1 ring-foreground' : 'hover:bg-muted/50',
                )}
              >
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
          {settings.away_behavior === 'ask_whatsapp' && (
            <div className="space-y-1.5">
              <Label htmlFor="away-msg">Mensagem de ausência</Label>
              <Textarea
                id="away-msg"
                rows={2}
                maxLength={300}
                value={settings.away_message}
                onChange={(e) => set('away_message', e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horário de funcionamento</CardTitle>
              <CardDescription>
                Fora do horário, nenhuma tela de chat aparece para novos visitantes. Conversas em andamento continuam.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bh-enabled" className="text-xs text-muted-foreground">Restringir por horário</Label>
              <Switch
                id="bh-enabled"
                checked={settings.business_hours_enabled}
                onCheckedChange={(v) => set('business_hours_enabled', v)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className={settings.business_hours_enabled ? 'space-y-3' : 'space-y-3 opacity-50 pointer-events-none'}>
          <div className="flex items-center gap-3">
            <Label className="text-sm w-24">Fuso</Label>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={settings.timezone}
              onChange={(e) => set('timezone', e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace('America/', '').replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          {DAYS.map((d) => {
            const h = settings.business_hours[d.key] ?? { enabled: false, start: '09:00', end: '18:00' };
            return (
              <div key={d.key} className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 w-32">
                  <Switch checked={h.enabled} onCheckedChange={(v) => setDay(d.key, { enabled: v })} />
                  <span className="text-sm">{d.label}</span>
                </div>
                <Input type="time" className="w-28" value={h.start} disabled={!h.enabled} onChange={(e) => setDay(d.key, { start: e.target.value })} />
                <span className="text-sm text-muted-foreground">até</span>
                <Input type="time" className="w-28" value={h.end} disabled={!h.enabled} onChange={(e) => setDay(d.key, { end: e.target.value })} />
                {!h.enabled && <span className="text-xs text-muted-foreground">fechado</span>}
              </div>
            );
          })}

          <div className="pt-3 border-t space-y-2">
            <Label>Feriados e dias fechados</Label>
            <div className="flex gap-2">
              <Input type="date" className="w-44" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={addHoliday} disabled={!newHoliday}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            {settings.holidays.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.holidays.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1">
                    {new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    <button type="button" onClick={() => set('holidays', settings.holidays.filter((x) => x !== d))} aria-label="Remover">×</button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quando e para quem o pop-up aparece</CardTitle>
          <CardDescription>O balão abre no primeiro gatilho que acontecer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="auto-open">Abrir o balão automaticamente</Label>
              <p className="text-xs text-muted-foreground">Desligado: aparece só o botão do chat no canto, sem balão.</p>
            </div>
            <Switch id="auto-open" checked={settings.auto_open} onCheckedChange={(v) => set('auto_open', v)} />
          </div>

          <div className={cn('grid sm:grid-cols-2 gap-4', !settings.auto_open && 'opacity-50 pointer-events-none')}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="delay">Depois de X segundos na página</Label>
                <Switch checked={settings.delay_trigger_enabled} onCheckedChange={(v) => set('delay_trigger_enabled', v)} />
              </div>
              <Input
                id="delay"
                type="number"
                min={0}
                max={600}
                disabled={!settings.delay_trigger_enabled}
                value={settings.open_delay_seconds}
                onChange={(e) => set('open_delay_seconds', Math.min(600, Math.max(0, Number(e.target.value) || 0)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trigger-section">Quando chegar na seção</Label>
              <select
                id="trigger-section"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={settings.trigger_section ?? ''}
                onChange={(e) => set('trigger_section', e.target.value || null)}
              >
                <option value="">Desligado</option>
                {Object.entries(LANDING_SECTION_LABELS)
                  .filter(([k]) => k !== 'footer')
                  .map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trigger-scroll">Quando rolar X% da página (vazio = desligado)</Label>
              <Input
                id="trigger-scroll"
                type="number"
                min={10}
                max={100}
                placeholder="Ex.: 60"
                value={settings.trigger_scroll_percent ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Math.min(100, Math.max(10, Number(e.target.value) || 10));
                  set('trigger_scroll_percent', v);
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3">
              <div>
                <Label htmlFor="exit">Ao tentar sair da página</Label>
                <p className="text-xs text-muted-foreground">Só no computador.</p>
              </div>
              <Switch id="exit" checked={settings.trigger_exit_intent} onCheckedChange={(v) => set('trigger_exit_intent', v)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cooldown">Depois que o visitante fechar, não abrir sozinho por (dias)</Label>
              <Input
                id="cooldown"
                type="number"
                min={0}
                max={90}
                value={settings.reopen_cooldown_days}
                onChange={(e) => set('reopen_cooldown_days', Math.min(90, Math.max(0, Number(e.target.value) || 0)))}
              />
              <p className="text-xs text-muted-foreground">0 = volta a abrir em outra aba ou visita. O botão do chat continua disponível.</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3">
              <Label htmlFor="mobile">Exibir em celulares</Label>
              <Switch id="mobile" checked={settings.show_on_mobile} onCheckedChange={(v) => set('show_on_mobile', v)} />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="hide-customers">Não mostrar para clientes com plano ativo</Label>
              <p className="text-xs text-muted-foreground">
                Esconde só de quem está logado com plano ativo. Quem se cadastrou e ainda não contratou, está em teste grátis
                ou tem plano vencido continua vendo o chat, porque ainda é um lead.
              </p>
            </div>
            <Switch id="hide-customers" checked={settings.hide_for_active_customers} onCheckedChange={(v) => set('hide_for_active_customers', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagens para o visitante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cta">Chamada após a saudação</Label>
            <Textarea id="cta" rows={2} maxLength={240} value={settings.greeting_cta} onChange={(e) => set('greeting_cta', e.target.value)} />
            <p className="text-xs text-muted-foreground">
              A mensagem fica: “Boa tarde! Sou Camila, consultora comercial da VitrineTurbo. {settings.greeting_cta}”
            </p>
          </div>
          <div className="rounded-md border px-3 py-2 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="require-whatsapp">Pedir o WhatsApp para continuar</Label>
                <p className="text-xs text-muted-foreground">
                  Assim que o visitante responder a saudação, o chat pede o número e só libera o campo de mensagem depois
                  que ele enviar.
                </p>
              </div>
              <Switch id="require-whatsapp" checked={settings.require_whatsapp} onCheckedChange={(v) => set('require_whatsapp', v)} />
            </div>
            {settings.require_whatsapp && (
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp-request">Mensagem do pedido</Label>
                <Textarea
                  id="whatsapp-request"
                  rows={2}
                  maxLength={300}
                  value={settings.whatsapp_request_message}
                  onChange={(e) => set('whatsapp_request_message', e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr">Botões de resposta rápida do visitante (um por linha, até 6)</Label>
            <Textarea id="qr" rows={4} value={quickRepliesText} onChange={(e) => setQuickRepliesText(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserRound className="h-4 w-4" /> Persona padrão</CardTitle>
          <CardDescription>
            Usada quando não há nenhum operador ativo. Personas: <Link to="/admin/live-chat/operators" className="underline">gerenciar operadores</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="h-12 w-12">
            {settings.fallback_avatar_url && <AvatarImage src={settings.fallback_avatar_url} alt="" />}
            <AvatarFallback>{settings.fallback_operator_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label htmlFor="fallback-name">Nome exibido</Label>
            <Input id="fallback-name" maxLength={60} value={settings.fallback_operator_name} onChange={(e) => set('fallback_operator_name', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />} Foto/logo
            </Button>
            {settings.fallback_avatar_url && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set('fallback_avatar_url', null)}>Remover</Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/webp,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                onFallbackAvatar(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respostas prontas do operador</CardTitle>
          <CardDescription>Aparecem no botão “Respostas prontas” da conversa. Salvam na hora.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canned.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-md border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{r.body}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setCannedDraft({ id: r.id, title: r.title, body: r.body })}>Editar</Button>
              <Button size="icon" variant="ghost" onClick={() => removeCanned(r.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {cannedDraft ? (
            <div className="rounded-md border p-3 space-y-2">
              <Input placeholder="Título (ex.: Preços)" maxLength={60} value={cannedDraft.title} onChange={(e) => setCannedDraft({ ...cannedDraft, title: e.target.value })} />
              <Textarea rows={3} maxLength={2000} placeholder="Texto da resposta" value={cannedDraft.body} onChange={(e) => setCannedDraft({ ...cannedDraft, body: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setCannedDraft(null)}>Cancelar</Button>
                <Button size="sm" onClick={saveCanned}>Salvar resposta</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCannedDraft({ title: '', body: '' })}>
              <Plus className="h-4 w-4 mr-1" /> Nova resposta pronta
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gestão das conversas</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="unanswered">Destacar conversa sem resposta após (minutos)</Label>
            <Input
              id="unanswered"
              type="number"
              min={1}
              max={240}
              value={settings.unanswered_alert_minutes}
              onChange={(e) => set('unanswered_alert_minutes', Math.min(240, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="autoclose">Encerrar conversas paradas após (horas)</Label>
            <Input
              id="autoclose"
              type="number"
              min={1}
              max={720}
              value={settings.auto_close_idle_hours}
              onChange={(e) => set('auto_close_idle_hours', Math.min(720, Math.max(1, Number(e.target.value) || 1)))}
            />
            <p className="text-xs text-muted-foreground">Não encerra conversas com WhatsApp aguardando contato.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retenção de dados (LGPD)</CardTitle>
          <CardDescription>Uma limpeza automática roda todo dia às 06:17 UTC.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ret-s">Sessões sem conversa (dias)</Label>
              <Input
                id="ret-s"
                type="number"
                min={1}
                max={365}
                value={settings.retention_session_days}
                onChange={(e) => set('retention_session_days', Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ret-c">Conversas e números de WhatsApp (dias sem atividade)</Label>
              <Input
                id="ret-c"
                type="number"
                min={1}
                max={730}
                value={settings.retention_conversation_days}
                onChange={(e) => set('retention_conversation_days', Math.min(730, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
          </div>
          <Button variant="outline" onClick={cleanup} disabled={cleaning}>
            {cleaning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Limpar dados antigos agora
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Ban className="h-4 w-4" /> Visitantes bloqueados</CardTitle>
          <CardDescription>Bloqueie pela conversa, no botão “Bloquear visitante”.</CardDescription>
        </CardHeader>
        <CardContent>
          {blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum visitante bloqueado.</p>
          ) : (
            <div className="space-y-2">
              {blocked.map((b) => (
                <div key={b.visitor_id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-mono">#{b.visitor_id.slice(0, 6)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(b.blocked_at).toLocaleString('pt-BR')}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => unblock(b.visitor_id)}>Desbloquear</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* barra de salvar: só para os campos que não salvam no clique */}
      <div
        className={cn(
          'fixed bottom-4 left-1/2 -translate-x-1/2 md:left-[calc(50%+130px)] z-40 flex items-center gap-3 rounded-full border bg-background shadow-lg px-4 py-2 transition-all',
          dirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
        )}
      >
        <span className="text-sm">Alterações não salvas</span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
