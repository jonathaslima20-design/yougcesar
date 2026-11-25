import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  Info,
  Loader,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import PricingCard from '@/components/pricing/PricingCard';
import { PAID_PLANS } from '@/lib/pricingPlans';
import {
  CampaignRibbon,
  CampaignThemeIcon,
  CampaignTopBar,
  campaignCardProps,
  readableOn,
} from '@/components/landing/LandingCampaign';
import {
  CAMPAIGN_THEMES,
  LANDING_PLAN_OPTIONS,
  deleteLandingCampaign,
  fetchLandingCampaigns,
  formatCampaignDiscount,
  getCampaignStatus,
  getThemePreset,
  saveLandingCampaign,
  setLandingCampaignActive,
  type CampaignStatus,
  type CampaignTheme,
  type LandingCampaign,
  type LandingCampaignInput,
} from '@/lib/landingCampaigns';
import { fetchSignupDiscountSettings, type SignupDiscountSettings } from '@/lib/signupDiscountService';

// --- helpers ---------------------------------------------------------------

/** ISO → value for <input type="datetime-local"> in the admin's local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function formatPeriod(startsAt: string, endsAt: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${fmt(startsAt)} → ${fmt(endsAt)}`;
}

function newCampaignFromTheme(theme: CampaignTheme): LandingCampaignInput {
  const preset = getThemePreset(theme);
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
  return {
    name: preset.name,
    theme,
    title: preset.title,
    subtitle: preset.subtitle,
    badge_text: preset.badge_text,
    discount_type: 'percent',
    discount_value: 30,
    plan_ids: [],
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    show_ribbon: true,
    show_countdown: true,
    show_top_bar: false,
    primary_color: preset.primary_color,
    accent_color: preset.accent_color,
    text_color: preset.text_color,
    is_active: true,
  };
}

const STATUS_STYLE: Record<CampaignStatus, { label: string; className: string; dot: string }> = {
  live: { label: 'Ao vivo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
  scheduled: { label: 'Agendada', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  ended: { label: 'Encerrada', className: 'bg-zinc-100 text-zinc-600 border-zinc-200', dot: 'bg-zinc-400' },
  paused: { label: 'Pausada', className: 'bg-zinc-100 text-zinc-600 border-zinc-200', dot: 'bg-zinc-400' },
};

function StatusPill({ status }: { status: CampaignStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function welcomeLabel(w: SignupDiscountSettings | null): string {
  if (!w) return '—';
  const value = w.discount_type === 'percent' ? `${w.discount_value}%` : `R$ ${w.discount_value}`;
  return `${value} por ${w.hours_after_signup}h após o cadastro`;
}

function discountDiffersFromWelcome(c: Pick<LandingCampaign, 'discount_type' | 'discount_value'>, w: SignupDiscountSettings | null): boolean {
  if (!w) return false;
  if (!w.is_active) return true;
  return w.discount_type !== c.discount_type || Number(w.discount_value) !== Number(c.discount_value);
}

// --- preview ---------------------------------------------------------------

/**
 * Renders children at a fixed "desktop" width and scales them down to the
 * available column width, so the preview matches the real landing layout.
 */
function ScaledPreview({ width = 1080, children }: { width?: number; children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const s = Math.min(1, outer.clientWidth / width);
      setScale(s);
      setHeight(inner.scrollHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outerRef} className="w-full overflow-hidden" style={{ height }}>
      <div ref={innerRef} style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

function LandingPreview({ campaign }: { campaign: LandingCampaign }) {
  return (
    <Tabs defaultValue="precos" className="w-full">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="precos">Seção de planos</TabsTrigger>
        <TabsTrigger value="topo">Barra do topo</TabsTrigger>
      </TabsList>
      <TabsContent value="precos" className="mt-3">
        <div className="rounded-xl border overflow-hidden bg-white">
          <ScaledPreview>
            <div className="vt-root bg-white text-ink-900 px-10 py-12">
              <div className="font-mono-label uppercase text-[11px] text-ink-500">Planos</div>
              <div className="font-display font-semibold text-[44px] leading-[1.05] tracking-[-0.035em] mt-3">
                Escolha o plano ideal
              </div>
              {campaign.show_ribbon && (
                <div className="mt-8">
                  <CampaignRibbon campaign={campaign} />
                </div>
              )}
              <div className={`grid grid-cols-3 gap-5 ${campaign.show_ribbon ? 'mt-5' : 'mt-10'} [&_.reveal]:opacity-100 [&_.reveal]:translate-y-0`}>
                {PAID_PLANS.map((plan) => (
                  <PricingCard key={plan.id} plan={{ ...plan, benefits: plan.benefits.slice(0, 4) }} ctaHref="#" {...campaignCardProps(plan, campaign)} />
                ))}
              </div>
            </div>
          </ScaledPreview>
        </div>
      </TabsContent>
      <TabsContent value="topo" className="mt-3">
        <div className="rounded-xl border overflow-hidden bg-white">
          {campaign.show_top_bar ? (
            <ScaledPreview width={1280}>
              <div className="vt-root bg-white">
                <CampaignTopBar campaign={campaign} href="#" />
                <div className="h-16 px-10 flex items-center justify-between border-b border-zinc-100">
                  <span className="font-display font-semibold text-[20px]">VitrineTurbo</span>
                  <span className="rounded-full bg-ink-900 text-white px-5 py-2 text-[13px]">Criar Minha Loja</span>
                </div>
                <div className="px-10 py-10 font-display font-semibold text-[48px] tracking-[-0.03em] text-ink-900">
                  Sua loja online, pronta em minutos.
                </div>
              </div>
            </ScaledPreview>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              A barra do topo está desligada para esta campanha.
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

// --- editor ----------------------------------------------------------------

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-xs" />
      </div>
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 px-4 py-3 cursor-pointer">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ThemePicker({ value, onPick }: { value?: CampaignTheme; onPick: (t: CampaignTheme) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {CAMPAIGN_THEMES.map((t) => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
              selected ? 'ring-2 ring-offset-2 ring-primary' : ''
            }`}
            style={{ backgroundColor: t.primary_color, color: t.text_color }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl opacity-50 transition-opacity group-hover:opacity-80"
              style={{ backgroundColor: t.accent_color }}
            />
            <div className="relative">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: t.accent_color, color: readableOn(t.accent_color) }}
              >
                <CampaignThemeIcon theme={t.id} size={16} />
              </span>
              <div className="mt-3 text-sm font-semibold">{t.label}</div>
              <div className="mt-0.5 text-[11px] opacity-70 line-clamp-1">{t.title}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CampaignEditor({
  initial,
  editingId,
  welcome,
  onCancel,
  onSaved,
}: {
  initial: LandingCampaignInput;
  editingId: string | null;
  welcome: SignupDiscountSettings | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<LandingCampaignInput>(initial);
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<LandingCampaignInput>) => setForm((f) => ({ ...f, ...patch }));

  const applyTheme = (theme: CampaignTheme) => {
    const p = getThemePreset(theme);
    // Keep anything the admin already typed for name/texts unless it's still the
    // previous theme's default copy.
    const prev = getThemePreset(form.theme);
    update({
      theme,
      primary_color: p.primary_color,
      accent_color: p.accent_color,
      text_color: p.text_color,
      name: form.name === prev.name ? p.name : form.name,
      title: form.title === prev.title ? p.title : form.title,
      subtitle: form.subtitle === prev.subtitle ? p.subtitle : form.subtitle,
      badge_text: form.badge_text === prev.badge_text ? p.badge_text : form.badge_text,
    });
  };

  const allPlans = form.plan_ids.length === 0;
  const previewCampaign = useMemo<LandingCampaign>(() => ({ ...form, id: 'preview' }), [form]);
  const differs = discountDiffersFromWelcome(form, welcome);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Dê um nome para a campanha');
    if (!form.title.trim()) return toast.error('Informe o título exibido na landing');
    if (!(form.discount_value > 0)) return toast.error('Informe um desconto maior que zero');
    if (form.discount_type === 'percent' && form.discount_value >= 100) return toast.error('O percentual deve ser menor que 100%');
    if (new Date(form.ends_at) <= new Date(form.starts_at)) return toast.error('O fim deve ser depois do início');
    try {
      setSaving(true);
      await saveLandingCampaign(editingId, { ...form, name: form.name.trim(), title: form.title.trim() });
      toast.success(editingId ? 'Campanha atualizada' : 'Campanha criada');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar campanha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{editingId ? 'Editar campanha' : 'Nova campanha'}</h1>
            <p className="text-sm text-muted-foreground">Veja ao lado exatamente como vai aparecer na landing.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
            Salvar campanha
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tema</CardTitle>
          <CardDescription>Cada tema já vem com cores e textos prontos — dá para ajustar tudo depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker value={form.theme} onPick={applyTheme} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Período</CardTitle>
              <CardDescription>A campanha entra e sai do ar sozinha nesses horários.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Nome interno</Label>
                <Input id="c-name" value={form.name} maxLength={60} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="c-start">Início</Label>
                  <Input
                    id="c-start"
                    type="datetime-local"
                    value={toLocalInput(form.starts_at)}
                    onChange={(e) => e.target.value && update({ starts_at: fromLocalInput(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-end">Fim</Label>
                  <Input
                    id="c-end"
                    type="datetime-local"
                    value={toLocalInput(form.ends_at)}
                    onChange={(e) => e.target.value && update({ ends_at: fromLocalInput(e.target.value) })}
                  />
                </div>
              </div>
              <ToggleRow
                title="Campanha ativa"
                description="Desligada, ela não aparece mesmo dentro do período."
                checked={form.is_active}
                onChange={(v) => update({ is_active: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Desconto exibido</CardTitle>
              <CardDescription>Preço riscado e preço com desconto nos cartões de planos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.discount_type} onValueChange={(v) => update({ discount_type: v as 'percent' | 'fixed' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-value">Valor</Label>
                  <Input
                    id="c-value"
                    type="number"
                    min={1}
                    value={form.discount_value}
                    onChange={(e) => update({ discount_value: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Planos com desconto</Label>
                <div className="grid grid-cols-3 gap-2">
                  {LANDING_PLAN_OPTIONS.map((p) => {
                    const checked = allPlans || form.plan_ids.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : ''}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const current = allPlans ? LANDING_PLAN_OPTIONS.map((o) => o.id) : form.plan_ids;
                            const next = v ? [...current, p.id] : current.filter((id) => id !== p.id);
                            if (next.length === 0) return;
                            update({ plan_ids: next.length === LANDING_PLAN_OPTIONS.length ? [] : next });
                          }}
                        />
                        {p.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div
                className={`flex gap-3 rounded-lg border p-3 text-xs ${
                  differs ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {differs ? <TriangleAlert className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
                <div>
                  {differs ? (
                    <>
                      <strong>Atenção:</strong> o desconto que o usuário recebe depois do cadastro é o do{' '}
                      <Link to="/admin/signup-discount" className="underline font-medium">Desconto de Boas-vindas</Link>{' '}
                      ({welcome?.is_active ? welcomeLabel(welcome) : 'hoje desligado'}). Ajuste-o para bater com esta
                      campanha, senão o cliente verá um preço na landing e outro na hora de assinar.
                    </>
                  ) : (
                    <>Bate com o Desconto de Boas-vindas ativo ({welcomeLabel(welcome)}). 👍</>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Textos e cores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="c-title">Título</Label>
                <Input id="c-title" value={form.title} maxLength={70} onChange={(e) => update({ title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-subtitle">Subtítulo</Label>
                <Input id="c-subtitle" value={form.subtitle} maxLength={120} onChange={(e) => update({ subtitle: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-badge">Selo</Label>
                <Input id="c-badge" value={form.badge_text} maxLength={28} onChange={(e) => update({ badge_text: e.target.value })} />
                <p className="text-xs text-muted-foreground">Aparece nos cartões ao lado do desconto, ex.: “30% OFF · Black Friday”.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <ColorField label="Fundo" value={form.primary_color} onChange={(v) => update({ primary_color: v })} />
                <ColorField label="Destaque" value={form.accent_color} onChange={(v) => update({ accent_color: v })} />
                <ColorField label="Texto" value={form.text_color} onChange={(v) => update({ text_color: v })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Onde aparece</CardTitle>
              <CardDescription>O preço riscado nos cartões aparece sempre; o resto é opcional.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y border-t">
                <ToggleRow
                  title="Faixa na seção de planos"
                  description="Banner com o tema da campanha logo acima dos cartões."
                  checked={form.show_ribbon}
                  onChange={(v) => update({ show_ribbon: v })}
                />
                <ToggleRow
                  title="Contagem regressiva"
                  description="Dias, horas, minutos e segundos até o fim da campanha."
                  checked={form.show_countdown}
                  onChange={(v) => update({ show_countdown: v })}
                />
                <ToggleRow
                  title="Barra no topo do site"
                  description="Faixa fina acima do menu, com link para os planos."
                  checked={form.show_top_bar}
                  onChange={(v) => update({ show_top_bar: v })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-4 self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prévia</CardTitle>
              <CardDescription>Atualiza em tempo real enquanto você edita.</CardDescription>
            </CardHeader>
            <CardContent>
              <LandingPreview campaign={previewCampaign} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- list ------------------------------------------------------------------

function CampaignCard({
  campaign,
  welcome,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
}: {
  campaign: LandingCampaign;
  welcome: SignupDiscountSettings | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  const status = getCampaignStatus(campaign);
  const plans = campaign.plan_ids.length === 0
    ? 'Todos os planos'
    : LANDING_PLAN_OPTIONS.filter((p) => campaign.plan_ids.includes(p.id)).map((p) => p.label).join(', ');
  const placements = [
    campaign.show_ribbon && 'Faixa',
    campaign.show_countdown && 'Contador',
    campaign.show_top_bar && 'Barra do topo',
  ].filter(Boolean) as string[];
  const warn = status === 'live' && discountDiffersFromWelcome(campaign, welcome);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div
          className="relative overflow-hidden sm:w-56 shrink-0 p-5 flex flex-col justify-between gap-6"
          style={{ backgroundColor: campaign.primary_color, color: campaign.text_color }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -right-12 h-36 w-36 rounded-full blur-2xl opacity-50"
            style={{ backgroundColor: campaign.accent_color }}
          />
          <span
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: campaign.accent_color, color: readableOn(campaign.accent_color) }}
          >
            <CampaignThemeIcon theme={campaign.theme} size={18} />
          </span>
          <div className="relative">
            <div className="text-2xl font-bold tracking-tight">{formatCampaignDiscount(campaign)}</div>
            <div className="text-xs opacity-70 mt-0.5">{campaign.badge_text || getThemePreset(campaign.theme).label}</div>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold truncate">{campaign.name}</h3>
                <StatusPill status={status} />
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{campaign.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{campaign.is_active ? 'Ativa' : 'Pausada'}</span>
              <Switch checked={campaign.is_active} onCheckedChange={onToggle} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatPeriod(campaign.starts_at, campaign.ends_at)}</span>
            <span>{plans}</span>
            {placements.length > 0 && <span>{placements.join(' · ')}</span>}
          </div>

          {warn && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              O desconto mostrado é diferente do Desconto de Boas-vindas ({welcome?.is_active ? welcomeLabel(welcome) : 'desligado'}).
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
            <Button size="sm" variant="outline" onClick={onDuplicate}><Copy className="mr-1.5 h-3.5 w-3.5" />Duplicar</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

type EditorState = { id: string | null; initial: LandingCampaignInput } | null;

function stripId(c: LandingCampaign): LandingCampaignInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, updated_at, ...rest } = c;
  return rest;
}

export default function LandingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<LandingCampaign[]>([]);
  const [welcome, setWelcome] = useState<SignupDiscountSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState>(null);
  const [toDelete, setToDelete] = useState<LandingCampaign | null>(null);

  const load = async () => {
    try {
      const [list, w] = await Promise.all([fetchLandingCampaigns(), fetchSignupDiscountSettings()]);
      setCampaigns(list);
      setWelcome(w);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const order: Record<CampaignStatus, number> = { live: 0, scheduled: 1, paused: 2, ended: 3 };
    return [...campaigns].sort((a, b) => {
      const d = order[getCampaignStatus(a)] - order[getCampaignStatus(b)];
      return d !== 0 ? d : new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  }, [campaigns]);

  const live = campaigns.find((c) => getCampaignStatus(c) === 'live');

  const handleToggle = async (c: LandingCampaign, v: boolean) => {
    try {
      await setLandingCampaignActive(c.id, v);
      setCampaigns((list) => list.map((x) => (x.id === c.id ? { ...x, is_active: v } : x)));
      toast.success(v ? 'Campanha ativada' : 'Campanha pausada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteLandingCampaign(toDelete.id);
      setCampaigns((list) => list.filter((x) => x.id !== toDelete.id));
      toast.success('Campanha excluída');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 flex items-center justify-center py-24">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (editor) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <CampaignEditor
          key={editor.id ?? 'new'}
          initial={editor.initial}
          editingId={editor.id}
          welcome={welcome}
          onCancel={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-700 text-amber-400 shadow-sm">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Campanhas da Landing</h1>
            <p className="text-sm text-muted-foreground">Black Friday, Natal, Ano Novo… com preço riscado e contador na seção de planos.</p>
          </div>
        </div>
        <Button onClick={() => setEditor({ id: null, initial: newCampaignFromTheme('black_friday') })}>
          <Plus className="mr-1.5 h-4 w-4" />Nova campanha
        </Button>
      </div>

      <div className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <div className="text-muted-foreground">
          A campanha muda <strong className="text-foreground">só a vitrine de preços da landing</strong>. O desconto
          que o novo usuário recebe ao assinar continua vindo do{' '}
          <Link to="/admin/signup-discount" className="font-medium text-foreground underline">Desconto de Boas-vindas</Link>{' '}
          (hoje: {welcome?.is_active ? welcomeLabel(welcome) : 'desligado'}) — renovações nunca recebem desconto de campanha.
        </div>
      </div>

      {live && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> No ar agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScaledPreview>
              <div className="vt-root"><CampaignRibbon campaign={live} /></div>
            </ScaledPreview>
          </CardContent>
        </Card>
      )}

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comece por um modelo</CardTitle>
            <CardDescription>Escolha um tema — cores, textos e selo já vêm prontos.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemePicker onPick={(t) => setEditor({ id: null, initial: newCampaignFromTheme(t) })} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              welcome={welcome}
              onEdit={() => setEditor({ id: c.id, initial: stripId(c) })}
              onDuplicate={() =>
                setEditor({
                  id: null,
                  initial: { ...stripId(c), name: `${c.name} (cópia)`, is_active: false },
                })
              }
              onDelete={() => setToDelete(c)}
              onToggle={(v) => handleToggle(c, v)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.name}” será removida definitivamente. Se ela estiver no ar, sai da landing na hora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
