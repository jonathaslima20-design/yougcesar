import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader as Loader2, ExternalLink, Copy, Check, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDashboardRevenue } from '@/hooks/useDashboardRevenue';
import { useSalesFunnel } from '@/hooks/useSalesFunnel';
import { useInventoryEnabled } from '@/hooks/useInventoryEnabled';
import { useDashboardPeriod } from '@/hooks/useDashboardPeriod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/utils';
import { ViewsAndLeadsChart } from '@/components/dashboard/ViewsAndLeadsChart';
import { TopProductsList } from '@/components/dashboard/TopProductsList';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { DashboardPeriodFilter } from '@/components/dashboard/DashboardPeriodFilter';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const PERIOD_STORAGE_KEY = 'vitrineturbo_dashboard_period';

// Headline indicator: big value, change against the previous period, and a short hint.
function KpiCard({
  title,
  value,
  change,
  hint,
  loading,
}: {
  title: string;
  value: string;
  change?: number;
  hint: string;
  loading: boolean;
}) {
  const up = (change ?? 0) > 0;
  const down = (change ?? 0) < 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-3xl font-bold">{value}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {change !== undefined && (
                <span
                  className={`inline-flex items-center gap-0.5 font-medium ${
                    up ? 'text-emerald-600' : down ? 'text-red-600' : 'text-muted-foreground'
                  }`}
                >
                  {up && <ArrowUp className="h-3 w-3" />}
                  {down && <ArrowDown className="h-3 w-3" />}
                  {Math.abs(change).toFixed(0)}%
                </span>
              )}
              <span className="text-muted-foreground">{hint}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Secondary figure, shown inside "Mais detalhes".
function DetailItem({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <p className="mt-1 text-xl font-semibold">{value}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periodDays, handlePeriodChange] = useDashboardPeriod(PERIOD_STORAGE_KEY);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const {
    totalProducts,
    totalViews,
    totalOrders,
    whatsappClicks,
    purchasesPerVisitor,
    contactsPerVisitor,
    lowStockCount,
    outOfStockCount,
    loading,
    error,
  } = useDashboardStats(periodDays);
  const { stages, loading: funnelLoading } = useSalesFunnel(periodDays);
  const revenue = useDashboardRevenue(periodDays);
  const { inventoryEnabled } = useInventoryEnabled();

  // Funnel stages from get_store_funnel: 0 Visitantes, 2 Contatos, 4 Vendas.
  const visitors = stages[0];
  const contacts = stages[2];
  const sales = stages[4];
  const kpiLoading = funnelLoading || revenue.loading;

  const storeUrl = user?.custom_domain
    ? `https://${user.custom_domain}`
    : user?.slug
    ? `https://vitrineturbo.com/${user.slug}`
    : '';

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

    window.open(storeUrl, '_blank');
  };

  const handleCopyLink = async () => {
    if (!storeUrl) {
      toast.warning('Configure o link da sua vitrine primeiro', {
        action: {
          label: 'Configurar agora',
          onClick: () => navigate('/dashboard/settings'),
        },
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopiedLink(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  const periodLabel = `nos últimos ${periodDays} dias`;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden sm:block">Bem-vindo de volta, {user?.name || 'Usuário'}!</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">
              Este é o link do seu catálogo. Copie para compartilhar ou abra para visualizar.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={storeUrl || 'Configure seu link em Configurações'}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                onClick={handleCopyLink}
                variant={copiedLink ? 'secondary' : 'outline'}
                className="shrink-0 min-w-[90px] transition-all duration-200"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
              <Button
                onClick={handleViewStorefront}
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Abrir vitrine"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <DashboardPeriodFilter value={periodDays} onChange={handlePeriodChange} />
      </div>

      <OnboardingChecklist />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Headline indicators: what the store owner checks first */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Faturamento"
          value={formatCurrency(revenue.totalRevenue)}
          change={revenue.revenueChange}
          hint={periodLabel}
          loading={kpiLoading}
        />
        <KpiCard
          title="Vendas"
          value={String(sales?.value ?? 0)}
          change={sales?.change}
          hint={periodLabel}
          loading={kpiLoading}
        />
        <KpiCard
          title="Visitantes"
          value={String(visitors?.value ?? 0)}
          change={visitors?.change}
          hint="visitantes únicos"
          loading={kpiLoading}
        />
        <KpiCard
          title="Contatos"
          value={String(contacts?.value ?? 0)}
          change={contacts?.change}
          hint="formulários e pedidos de contato"
          loading={kpiLoading}
        />
      </div>

      {/* Main chart */}
      <ViewsAndLeadsChart days={periodDays} />

      {/* Products and activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopProductsList periodDays={periodDays} />
        <RecentActivityFeed />
      </div>

      {/* Secondary figures, collapsed by default */}
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => setShowDetails(v => !v)} className="gap-1.5 text-muted-foreground">
          Mais detalhes
          <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </Button>

        {showDetails && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Visualizações únicas" value={String(totalViews)} loading={loading} />
                <DetailItem label="Pedidos" value={String(totalOrders)} loading={loading} />
                <DetailItem label="Ticket médio" value={formatCurrency(revenue.averageTicket)} loading={revenue.loading} />
                <DetailItem label="Pedidos entregues" value={String(revenue.totalDelivered)} loading={revenue.loading} />
                <DetailItem label="Cliques no WhatsApp" value={String(whatsappClicks)} loading={loading} />
                <DetailItem label="Compras por visitante" value={`${purchasesPerVisitor.toFixed(1)}%`} loading={loading} />
                <DetailItem label="Contatos por visitante" value={`${contactsPerVisitor.toFixed(1)}%`} loading={loading} />
                <DetailItem label="Total de produtos" value={String(totalProducts)} loading={loading} />
                {inventoryEnabled && (
                  <DetailItem
                    label="Estoque"
                    value={lowStockCount + outOfStockCount > 0
                      ? `${outOfStockCount} esgotado${outOfStockCount === 1 ? '' : 's'} / ${lowStockCount} baixo${lowStockCount === 1 ? '' : 's'}`
                      : 'Tudo em ordem'}
                    loading={loading}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
