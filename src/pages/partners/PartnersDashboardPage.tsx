import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Gift,
  Hourglass,
  Megaphone,
  Repeat,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import {
  formatBRL,
  partnerApi,
  type PartnerCampaign,
  type PartnerClient,
  type PartnerCommission,
} from '@/lib/partners/partnerApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, StatCard, ToneBadge, daysUntil, formatDate } from '@/components/partners/PartnerUi';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface Alert {
  key: string;
  tone: 'amber' | 'red' | 'blue';
  text: string;
  href: string;
}

export default function PartnersDashboardPage() {
  const { user } = useAuth();
  const { overview, profile, settings, isOwner, canManage, partnerId } = usePartner();
  const [clients, setClients] = useState<PartnerClient[] | null>(null);
  const [commissions, setCommissions] = useState<PartnerCommission[]>([]);
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [hasPixKey, setHasPixKey] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (!partnerId || !user?.id) return;
    partnerApi.clients().then(setClients).catch(() => setClients([]));
    partnerApi.campaigns().then(setCampaigns).catch(() => undefined);
    supabase.from('partner_lesson_progress').select('lesson_id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => setLessonsDone(count ?? 0));
    supabase.from('partner_clicks').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId).then(({ count }) => setClickCount(count ?? 0));
    if (isOwner) {
      partnerApi.commissions(partnerId).then(setCommissions).catch(() => undefined);
      supabase.from('user_pix_keys').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => setHasPixKey((count ?? 0) > 0));
    }
  }, [partnerId, user?.id, isOwner]);

  const level = overview?.level;
  const next = overview?.next_level;
  const mrrProgress = next ? Math.min(100, (Number(overview?.mrr ?? 0) / Math.max(Number(next.min_mrr), 1)) * 100) : 100;
  const clientsProgress = next ? Math.min(100, ((overview?.active_clients ?? 0) / Math.max(next.min_active_clients, 1)) * 100) : 100;
  const bestProgress = Math.max(mrrProgress, clientsProgress);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = commissions
    .filter((c) => c.status !== 'reversed' && new Date(c.created_at).getTime() >= monthStart)
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const series = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()], new: 0, renewal: 0, bonus: 0 };
    });
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const c of commissions) {
      if (c.status === 'reversed' || c.type === 'clawback') continue;
      const d = new Date(c.created_at);
      const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i === undefined) continue;
      const bucket = c.type === 'new' ? 'new' : c.type === 'renewal' ? 'renewal' : 'bonus';
      buckets[i][bucket] += Number(c.amount);
    }
    return buckets;
  }, [commissions]);

  const alerts = useMemo<Alert[]>(() => {
    if (!clients) return [];
    const list: Alert[] = [];
    for (const c of clients) {
      const trialDays = daysUntil(c.trial_ends_at);
      if (c.plan_status === 'trial' && trialDays !== null && trialDays <= 3) {
        list.push({ key: `trial-${c.id}`, tone: 'amber', text: `Teste de ${c.name} termina ${trialDays <= 0 ? 'hoje' : `em ${trialDays} dia${trialDays > 1 ? 's' : ''}`}. Ajude a escolher o plano.`, href: `/partners/clients/${c.id}` });
      } else if (c.health === 'renewing') {
        list.push({ key: `renew-${c.id}`, tone: 'blue', text: `${c.name} renova em ${formatDate(c.next_payment_date)}.`, href: `/partners/clients/${c.id}` });
      } else if (c.health === 'lapsed') {
        list.push({ key: `lapsed-${c.id}`, tone: 'red', text: `O plano de ${c.name} venceu. Um contato agora pode recuperar o cliente.`, href: `/partners/clients/${c.id}` });
      } else if (c.health === 'setup' && Date.now() - new Date(c.created_at).getTime() > 7 * 86400000) {
        list.push({ key: `setup-${c.id}`, tone: 'amber', text: `A loja de ${c.name} ainda não tem produtos.`, href: `/partners/clients/${c.id}` });
      }
      if (!c.client_accepted && c.origin === 'created') {
        list.push({ key: `invite-${c.id}`, tone: 'blue', text: `${c.name} ainda não aceitou o convite para assumir a loja.`, href: `/partners/clients/${c.id}` });
      }
    }
    return list.slice(0, 8);
  }, [clients]);

  const steps = [
    { done: !!(profile?.company_name || profile?.bio || profile?.logo_url), label: 'Complete seu perfil de parceiro', href: '/partners/profile', ownerOnly: true },
    { done: hasPixKey, label: 'Cadastre sua chave PIX para receber', href: '/partners/finance', ownerOnly: true },
    { done: lessonsDone > 0, label: 'Assista à primeira aula da Academia', href: '/partners/academy' },
    { done: clickCount > 0, label: 'Compartilhe seu link pela primeira vez', href: '/partners/links' },
    { done: (clients?.length ?? 0) > 0, label: 'Traga seu primeiro cliente', href: canManage ? '/partners/new-store' : '/partners/links' },
  ].filter((s) => isOwner || !s.ownerOnly);
  const stepsDone = steps.filter((s) => s.done).length;

  const firstSaleDeadline = profile && settings ? new Date(new Date(profile.approved_at).getTime() + settings.first_sale_bonus_days * 86400000) : null;
  const firstSalePending = isOwner && firstSaleDeadline && firstSaleDeadline.getTime() > Date.now() && !commissions.some((c) => c.type === 'new');

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title={`Olá, ${user?.name?.split(' ')[0] || 'Parceiro'}`}
        description="Sua carteira, seus ganhos e o que precisa da sua atenção hoje."
        actions={
          canManage ? (
            <Button asChild>
              <Link to="/partners/new-store"><Store className="h-4 w-4 mr-2" />Nova loja</Link>
            </Button>
          ) : undefined
        }
      />

      {firstSalePending && settings && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
          <Gift className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>Bônus de primeira venda:</strong> feche seu primeiro cliente até {formatDate(firstSaleDeadline!.toISOString())} e ganhe{' '}
            <strong>{formatBRL(settings.first_sale_bonus_amount)}</strong> além da comissão.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita da carteira" value={formatBRL(overview?.mrr)} hint="mensal recorrente" icon={TrendingUp} />
        <StatCard title="Clientes ativos" value={overview?.active_clients ?? 0} hint={`${clients?.length ?? 0} na carteira`} icon={Users} />
        {isOwner ? (
          <>
            <StatCard title="Disponível para saque" value={formatBRL(overview?.balance?.available)} hint={`${formatBRL(overview?.balance?.holding)} em carência`} icon={Wallet} accent="green" />
            <StatCard title="Comissões este mês" value={formatBRL(thisMonth)} hint={`Taxa atual: ${overview?.rate ?? 0}%`} icon={Repeat} />
          </>
        ) : (
          <StatCard title="Acessos aos links" value={clickCount} hint="desde o início" icon={Megaphone} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" /> Seu nível
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-bold flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: level?.color ?? '#999' }} />
                  {level?.name ?? '—'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {overview?.rate ?? 0}% recorrente{overview?.is_founder ? ' · Fundador' : ''}
                </p>
              </div>
              {overview?.certified_at && <ToneBadge tone="green"><BadgeCheck className="h-3.5 w-3.5" />Certificado</ToneBadge>}
            </div>
            {next ? (
              <div className="space-y-2">
                <Progress value={bestProgress} />
                <p className="text-xs text-muted-foreground">
                  Para {next.name} ({Number(next.commission_percentage)}%): {formatBRL(next.min_mrr)}/mês de carteira <em>ou</em>{' '}
                  {next.min_active_clients} clientes ativos. Você tem {formatBRL(overview?.mrr)} e {overview?.active_clients ?? 0}.
                </p>
                {next.requires_certification && !overview?.certified_at && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    O nível {next.name} exige a certificação.{' '}
                    <Link to="/partners/academy" className="underline">Fazer agora</Link>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Você está no nível mais alto do programa.</p>
            )}
            {overview?.level_below_since && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Sua carteira está abaixo do critério do nível atual desde {formatDate(overview.level_below_since)}. Você mantém o nível por 2 meses.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">O que precisa de atenção</CardTitle>
            <Link to="/partners/clients" className="text-xs text-primary hover:underline">Ver carteira</Link>
          </CardHeader>
          <CardContent>
            {clients === null ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nada pendente na sua carteira agora. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.key}>
                    <Link to={a.href} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                      {a.tone === 'red' ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" /> : a.tone === 'amber' ? <Hourglass className="h-4 w-4 text-amber-500 shrink-0" /> : <CalendarClock className="h-4 w-4 text-sky-500 shrink-0" />}
                      <span className="text-sm flex-1">{a.text}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {stepsDone < steps.length && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Primeiros passos · {stepsDone}/{steps.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={(stepsDone / steps.length) * 100} className="mb-4" />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link to={s.href} className="flex items-center gap-2.5 rounded-lg border p-3 text-sm hover:bg-muted/40">
                    {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className={s.done ? 'line-through text-muted-foreground' : ''}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(campaigns.length > 0 || settings?.webinar_url || settings?.community_url) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} className="border-primary/30">
              <CardContent className="pt-6 space-y-2">
                <ToneBadge tone="blue"><Sparkles className="h-3.5 w-3.5" />Campanha</ToneBadge>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.kind === 'multiplier'
                    ? `Comissão de novas assinaturas multiplicada por ${Number(c.multiplier)}x.`
                    : `Traga ${c.goal_new_clients} clientes novos e ganhe ${formatBRL(c.goal_bonus_amount)}.`}
                  {c.description ? ` ${c.description}` : ''}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Até {formatDate(c.ends_at)}</p>
              </CardContent>
            </Card>
          ))}
          {settings?.webinar_url && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <ToneBadge tone="green"><Video className="h-3.5 w-3.5" />Webinar</ToneBadge>
                <p className="font-semibold">Encontro de parceiros</p>
                <p className="text-sm text-muted-foreground">{settings.webinar_at ? formatDate(settings.webinar_at, { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Novidades, cases e dúvidas ao vivo.'}</p>
                <Button asChild size="sm" variant="outline"><a href={settings.webinar_url} target="_blank" rel="noopener noreferrer">Participar</a></Button>
              </CardContent>
            </Card>
          )}
          {settings?.community_url && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <ToneBadge tone="muted"><Users className="h-3.5 w-3.5" />Comunidade</ToneBadge>
                <p className="font-semibold">Grupo oficial de parceiros</p>
                <p className="text-sm text-muted-foreground">Avisos, dicas de venda e troca com outros parceiros.</p>
                <Button asChild size="sm" variant="outline"><a href={settings.community_url} target="_blank" rel="noopener noreferrer">Entrar no grupo</a></Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comissões nos últimos 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                  formatter={(value: number, name: string) => [formatBRL(value), name === 'new' ? 'Novas' : name === 'renewal' ? 'Renovações' : 'Bônus']}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === 'new' ? 'Novas assinaturas' : v === 'renewal' ? 'Renovações' : 'Bônus')} />
                <Bar dataKey="new" stackId="a" fill="hsl(var(--chart-1))" maxBarSize={32} />
                <Bar dataKey="renewal" stackId="a" fill="hsl(var(--chart-2))" maxBarSize={32} />
                <Bar dataKey="bonus" stackId="a" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
