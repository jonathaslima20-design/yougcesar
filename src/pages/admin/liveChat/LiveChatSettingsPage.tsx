import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Save, Trash2, Clock, Radio, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  fetchLiveChatSettings,
  fetchPublicStatus,
  runCleanupNow,
  updateLiveChatSettings,
} from '@/lib/liveChat/adminService';
import type { LiveChatPublicConfig, LiveChatSettings } from '@/lib/liveChat/types';

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

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function LiveChatSettingsPage() {
  const [settings, setSettings] = useState<LiveChatSettings | null>(null);
  const [status, setStatus] = useState<LiveChatPublicConfig | null>(null);
  const [quickRepliesText, setQuickRepliesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshStatus = () => fetchPublicStatus().then(setStatus).catch(() => setStatus(null));

  useEffect(() => {
    fetchLiveChatSettings()
      .then((s) => {
        setSettings(s);
        setQuickRepliesText((s.quick_replies ?? []).join('\n'));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar'));
    refreshStatus();
  }, []);

  if (loadError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-sm text-destructive">
          Não foi possível carregar as configurações do chat ({loadError}). A migration
          <code className="mx-1">20261031120000_live_chat_operator.sql</code> já foi aplicada?
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
      const { id: _id, updated_at: _u, ...rest } = settings;
      await updateLiveChatSettings({
        ...rest,
        quick_replies: quickRepliesText
          .split('\n')
          .map((q) => q.trim())
          .filter(Boolean)
          .slice(0, 6),
      });
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

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Configurações do Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Chat com operador e monitoramento de visitantes da landing page. Tudo muda na hora, sem deploy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={status.chat_available ? 'default' : 'secondary'}>
              Chat agora: {status.chat_available ? 'visível para visitantes' : 'oculto'}
            </Badge>
          )}
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos em tempo real</CardTitle>
          <CardDescription>Cada recurso pode ser desligado de forma independente para controlar custos no Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <ToggleRow
            icon={<MessageCircle className="h-5 w-5" />}
            title="Chat na landing page"
            description="Mostra o pop-up de atendimento para visitantes (respeitando o horário de funcionamento)."
            checked={settings.chat_enabled}
            onChange={(v) => set('chat_enabled', v)}
          />
          <ToggleRow
            icon={<Radio className="h-5 w-5" />}
            title="Monitoramento de visitantes ao vivo"
            description="Heartbeat a cada 30 s com a seção atual e o tempo de sessão. Não abre conexão em tempo real para o visitante."
            checked={settings.tracking_enabled}
            onChange={(v) => set('tracking_enabled', v)}
          />
          <ToggleRow
            icon={<span className="text-lg leading-none">…</span>}
            title='Indicador "digitando…"'
            description="Mostra quando o visitante ou o operador está digitando (só em conversas já abertas)."
            checked={settings.typing_indicator_enabled}
            onChange={(v) => set('typing_indicator_enabled', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horário de funcionamento</CardTitle>
              <CardDescription>Fora do horário ativo, nenhuma tela de chat aparece para o visitante.</CardDescription>
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
                <Input
                  type="time"
                  className="w-28"
                  value={h.start}
                  disabled={!h.enabled}
                  onChange={(e) => setDay(d.key, { start: e.target.value })}
                />
                <span className="text-sm text-muted-foreground">até</span>
                <Input
                  type="time"
                  className="w-28"
                  value={h.end}
                  disabled={!h.enabled}
                  onChange={(e) => setDay(d.key, { end: e.target.value })}
                />
                {!h.enabled && <span className="text-xs text-muted-foreground">fechado</span>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comportamento do pop-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="delay">Abrir após (segundos com a página visível)</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                max={600}
                value={settings.open_delay_seconds}
                onChange={(e) => set('open_delay_seconds', Math.min(600, Math.max(0, Number(e.target.value) || 0)))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3">
              <Label htmlFor="mobile">Exibir em celulares</Label>
              <Switch id="mobile" checked={settings.show_on_mobile} onCheckedChange={(v) => set('show_on_mobile', v)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta">Chamada após a saudação</Label>
            <Textarea
              id="cta"
              rows={2}
              maxLength={240}
              value={settings.greeting_cta}
              onChange={(e) => set('greeting_cta', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A mensagem fica: “Boa tarde! Sou Camila, consultora comercial da VitrineTurbo. {settings.greeting_cta}”
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr">Respostas rápidas (uma por linha, até 6)</Label>
            <Textarea id="qr" rows={4} value={quickRepliesText} onChange={(e) => setQuickRepliesText(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Personas exibidas no chat: <Link to="/admin/live-chat/operators" className="underline">gerenciar operadores</Link>.
          </p>
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
    </div>
  );
}
