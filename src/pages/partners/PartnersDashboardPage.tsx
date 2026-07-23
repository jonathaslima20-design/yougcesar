import { Link } from 'react-router-dom';
import { Users, UserPlus, MousePointerClick, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerDashboardStats } from '@/hooks/usePartnerDashboardStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function PartnersDashboardPage() {
  const { user } = useAuth();
  const { totalUsers, newUsers30Days, clickCount, recentUsers, loading } = usePartnerDashboardStats(user?.id);

  const conversionRate = clickCount > 0 ? Math.round((totalUsers / clickCount) * 100) : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Olá, {user?.name?.split(' ')[0] || 'Parceiro'}</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo dos usuários que você trouxe pro VitrineTurbo.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Meus Usuários" value={totalUsers} icon={Users} loading={loading} href="/partners/users" />
        <StatCard title="Novos (30 dias)" value={newUsers30Days} icon={UserPlus} loading={loading} />
        <StatCard title="Acessos ao Link" value={clickCount} icon={MousePointerClick} loading={loading} href="/partners/referral" />
        <StatCard title="Conversão" value={`${conversionRate}%`} icon={TrendingUp} loading={loading} />
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
