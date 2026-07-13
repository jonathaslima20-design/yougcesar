import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, Loader as Loader2, RefreshCw, ArrowUp, ArrowDown, CreditCard, TriangleAlert as AlertTriangle, UserPlus, ChevronRight, CalendarX2, Clock, Gift } from 'lucide-react';
import { useAdminDashboardStats } from '@/hooks/useAdminDashboardStats';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyI18n } from '@/lib/i18n';
import { getInitials } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboardPage() {
  const {
    totalUsers, growthPercentage, totalRevenue,
    activeSubscriptions, expiringIn7Days, expiredPlans, suspendedPlans, freePlans, newUsers30Days,
    recentUsers, expiringSubscriptions, weeklySignups, monthlyRevenue,
    loading, error, refresh,
  } = useAdminDashboardStats();

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const growthSubtitle = growthPercentage !== 0
    ? `${growthPercentage > 0 ? '+' : ''}${growthPercentage}% vs mês anterior`
    : 'mesmo que mês anterior';

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Painel Administrativo</h1>
          <p className="text-muted-foreground">Visão geral do sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Primary Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Usuários" value={totalUsers} subtitle="usuários cadastrados" icon={Users} loading={loading} href="/admin/users" />
        <StatCard title="Receita Recorrente" value={formatCurrencyI18n(totalRevenue, 'BRL', 'pt-BR')} subtitle="assinaturas ativas" icon={DollarSign} loading={loading} />
        <StatCard title="Assinaturas Ativas" value={activeSubscriptions} subtitle="planos pagos" icon={CreditCard} loading={loading} accent="green" href="/admin/users?plan=active" />
        <StatCard title="Novos Cadastros" value={newUsers30Days} subtitle={growthSubtitle} icon={UserPlus} loading={loading} accent="teal" href="/admin/users?date=last30days" />
      </div>

      {/* Secondary Stats - Alerts */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Planos Vencidos" value={expiredPlans} subtitle="não renovados" icon={CalendarX2} loading={loading} accent={expiredPlans > 0 ? "red" : undefined} href="/admin/users?plan=expired" />
        <StatCard title="Vencendo em 7 dias" value={expiringIn7Days} subtitle="risco de churn" icon={AlertTriangle} loading={loading} accent={expiringIn7Days > 0 ? "amber" : undefined} href="/admin/users?expiration=expiring-7days" />
        <StatCard title="Planos Suspensos" value={suspendedPlans} subtitle="assinatura suspensa" icon={Clock} loading={loading} accent={suspendedPlans > 0 ? "amber" : undefined} href="/admin/users?plan=suspended" />
        <StatCard title="Plano Gratuito" value={freePlans} subtitle="oportunidade de conversão" icon={Gift} loading={loading} href="/admin/users?plan=free" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Novos Usuários por Semana</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 3 meses</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[220px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklySignups}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                    formatter={(value: number) => [value, 'Usuários']}
                    labelFormatter={(label) => `Semana de ${label}`}
                  />
                  <Bar dataKey="count" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Receita Mensal</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[220px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                    formatter={(value: number) => [formatCurrencyI18n(value, 'BRL', 'pt-BR'), 'Receita']}
                  />
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--foreground))" fill="url(#revenueGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Atividade Recente</CardTitle>
              <p className="text-sm text-muted-foreground">Últimos usuários cadastrados</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/users" className="text-sm">
                Ver todos <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário cadastrado ainda</p>
            ) : (
              <div className="space-y-1">
                {recentUsers.slice(0, 8).map(user => (
                  <Link
                    key={user.id}
                    to={`/admin/users/${user.id}`}
                    className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <PlanBadge status={user.plan_status} />
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(user.created_at), 'dd/MM', { locale: ptBR })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Assinaturas Próximas do Vencimento</CardTitle>
              <p className="text-sm text-muted-foreground">Próximos 7 dias</p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : expiringSubscriptions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhuma assinatura vencendo nos próximos 7 dias</p>
              </div>
            ) : (
              <div className="space-y-1">
                {expiringSubscriptions.map(sub => {
                  const daysLeft = Math.ceil((new Date(sub.next_payment_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <Link
                      key={sub.user_id}
                      to={`/admin/users/${sub.user_id}`}
                      className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{sub.user_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{sub.user_email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                          {daysLeft === 0 ? 'Hoje' : `${daysLeft}d`}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(sub.next_payment_date), 'dd/MM', { locale: ptBR })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title, value, subtitle, icon: Icon, loading, accent, href,
}: {
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  accent?: 'green' | 'amber' | 'red' | 'teal';
  href?: string;
}) {
  const accentStyles = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    teal: 'text-teal-600',
  };

  const content = (
    <Card className={href ? 'hover:shadow-md hover:border-foreground/20 transition-all cursor-pointer' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accent ? accentStyles[accent] : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className={`text-xl font-bold ${accent ? accentStyles[accent] : ''}`}>{value}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link to={href} className="block">{content}</Link>;
  }

  return content;
}

function PlanBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-500 text-[10px] py-0 px-1.5">Ativo</Badge>;
    case 'free':
      return <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Free</Badge>;
    case 'suspended':
      return <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-300 text-amber-600">Suspenso</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] py-0 px-1.5">Sem plano</Badge>;
  }
}
