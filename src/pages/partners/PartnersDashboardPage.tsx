import { Link } from 'react-router-dom';
import { Users, UserPlus, MousePointerClick, TrendingUp, Wallet, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerDashboardStats } from '@/hooks/usePartnerDashboardStats';
import { usePartnerCommissionStats } from '@/hooks/usePartnerCommissionStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatCurrencyI18n } from '@/lib/i18n';

export default function PartnersDashboardPage() {
  const { user } = useAuth();
  const { totalUsers, newUsers30Days, clickCount, recentUsers, loading } = usePartnerDashboardStats(user?.id);
  const {
    totalEarned,
    pendingAmount,
    monthlySeries,
    currentTier,
    nextTier,
    progressToNextTier,
    activeUserCount,
    minimumWithdrawalAmount,
    loading: commissionsLoading,
  } = usePartnerCommissionStats(user?.id);

  const conversionRate = clickCount > 0 ? Math.round((totalUsers / clickCount) * 100) : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Olá, {user?.name?.split(' ')[0] || 'Parceiro'}</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo dos usuários que você trouxe pro VitrineTurbo.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Usuários Indicados" value={totalUsers} icon={Users} loading={loading} href="/partners/users" />
        <StatCard title="Novos (30 dias)" value={newUsers30Days} icon={UserPlus} loading={loading} />
        <StatCard title="Acessos ao Link" value={clickCount} icon={MousePointerClick} loading={loading} href="/partners/referral" />
        <StatCard title="Conversão" value={`${conversionRate}%`} icon={TrendingUp} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Comissões (últimos 12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {commissionsLoading ? (
              <div className="flex items-center justify-center h-[220px]">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlySeries} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value: number) => formatCurrencyI18n(value, 'BRL', 'pt-BR')}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === 'new' ? 'Novas assinaturas' : 'Renovações')} />
                  <Bar dataKey="new" name="new" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="renewal" name="renewal" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Award className="h-4 w-4" />
                Tier Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {commissionsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <p className="text-2xl font-bold">
                    {currentTier ? `${currentTier.commission_percentage}%` : '—'}
                  </p>
                  {nextTier ? (
                    <>
                      <Progress value={progressToNextTier * 100} />
                      <p className="text-xs text-muted-foreground">
                        {activeUserCount} de {nextTier.min_active_users} usuários ativos para atingir {nextTier.commission_percentage}%
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Você está no maior nível de comissão.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Link to="/partners/commissions">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Disponível para saque
                </CardTitle>
              </CardHeader>
              <CardContent>
                {commissionsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{formatCurrencyI18n(pendingAmount, 'BRL', 'pt-BR')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total ganho: {formatCurrencyI18n(totalEarned, 'BRL', 'pt-BR')} · mínimo para saque {formatCurrencyI18n(minimumWithdrawalAmount, 'BRL', 'pt-BR')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastros recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum usuário cadastrado ainda.{' '}
              <Link to="/partners/users/new" className="text-primary hover:underline">
                Cadastrar o primeiro
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {recentUsers.map((u) => (
                <Link
                  key={u.id}
                  to={`/partners/users/${u.id}`}
                  className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  href?: string;
}

function StatCard({ title, value, icon: Icon, loading, href }: StatCardProps) {
  const content = (
    <Card className={href ? 'hover:shadow-md transition-shadow' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{value}</p>}
      </CardContent>
    </Card>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}
