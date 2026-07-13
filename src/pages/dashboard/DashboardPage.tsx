import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, Users, DollarSign, Loader as Loader2, ExternalLink, ShoppingBag, TriangleAlert as AlertTriangle } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useInventoryEnabled } from '@/hooks/useInventoryEnabled';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ViewsAndLeadsChart } from '@/components/dashboard/ViewsAndLeadsChart';
import { RevenueCard } from '@/components/dashboard/RevenueCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { TopProductsList } from '@/components/dashboard/TopProductsList';
import { SalesFunnel } from '@/components/dashboard/SalesFunnel';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { DashboardPeriodFilter, PeriodOption } from '@/components/dashboard/DashboardPeriodFilter';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const PERIOD_STORAGE_KEY = 'vitrineturbo_dashboard_period';

function getStoredPeriod(): PeriodOption {
  const stored = localStorage.getItem(PERIOD_STORAGE_KEY);
  if (stored && [7, 15, 30, 90].includes(Number(stored))) {
    return Number(stored) as PeriodOption;
  }
  return 30;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periodDays, setPeriodDays] = useState<PeriodOption>(getStoredPeriod);
  const { totalProducts, totalViews, uniqueVisitors, totalLeads, totalOrders, lowStockCount, outOfStockCount, loading, error } = useDashboardStats(periodDays);
  const { inventoryEnabled } = useInventoryEnabled();

  const handlePeriodChange = (period: PeriodOption) => {
    setPeriodDays(period);
    localStorage.setItem(PERIOD_STORAGE_KEY, String(period));
  };

  const getMissingProfileFields = () => {
    const missing: string[] = [];
    if (!user?.name?.trim()) missing.push('nome');
    if (!user?.slug?.trim()) missing.push('link da vitrine');
    if (!user?.whatsapp?.trim()) missing.push('WhatsApp');
    return missing;
  };

  const handleViewStorefront = () => {
    const missing = getMissingProfileFields();

    if (missing.length > 0) {
      const fieldList = missing.join(', ');
      toast.warning('Perfil incompleto', {
        description: `Complete os campos obrigatórios antes de visualizar sua vitrine: ${fieldList}.`,
        action: {
          label: 'Configurar agora',
          onClick: () => navigate('/dashboard/settings'),
        },
        duration: 6000,
      });
      return;
    }

    const storeUrl = user!.custom_domain
      ? `https://${user!.custom_domain}`
      : `https://vitrineturbo.com/${user!.slug}`;
    window.open(storeUrl, '_blank');
  };

  const periodLabel = `nos últimos ${periodDays} dias`;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl page-title">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1 hidden sm:block">Bem-vindo de volta, {user?.name || 'Usuário'}!</p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleViewStorefront}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Ver Minha Vitrine</span>
            <span className="sm:hidden">Vitrine</span>
          </Button>
        </div>
        <DashboardPeriodFilter value={periodDays} onChange={handlePeriodChange} />
      </div>

      <OnboardingChecklist />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className={`grid gap-4 grid-cols-2 ${inventoryEnabled ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">produtos cadastrados</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalViews}</div>
                <p className="text-xs text-muted-foreground">{periodLabel}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visitantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{uniqueVisitors}</div>
                <p className="text-xs text-muted-foreground">visitantes únicos</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversões</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalLeads}</div>
                <p className="text-xs text-muted-foreground">contatos recebidos</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate('/dashboard/orders')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">{periodLabel}</p>
              </>
            )}
          </CardContent>
        </Card>

        {inventoryEnabled && (
          <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate('/dashboard/stock-movements')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${outOfStockCount > 0 ? 'text-red-500' : lowStockCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{lowStockCount + outOfStockCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {outOfStockCount > 0 ? `${outOfStockCount} esgotado${outOfStockCount > 1 ? 's' : ''}` : ''}
                    {outOfStockCount > 0 && lowStockCount > 0 ? ' / ' : ''}
                    {lowStockCount > 0 ? `${lowStockCount} baixo${lowStockCount > 1 ? 's' : ''}` : ''}
                    {outOfStockCount === 0 && lowStockCount === 0 ? 'tudo em ordem' : ''}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Revenue Cards */}
      <RevenueCard periodDays={periodDays} />

      {/* Charts Row: Revenue Chart + Sales Funnel */}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <RevenueChart periodDays={periodDays} />
        <SalesFunnel periodDays={periodDays} />
      </div>

      {/* Views & Leads Chart */}
      <ViewsAndLeadsChart days={periodDays} />

      {/* Top Products + Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <TopProductsList periodDays={periodDays} />
        <RecentActivityFeed />
      </div>

    </div>
  );
}
