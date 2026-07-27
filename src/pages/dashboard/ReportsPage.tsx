import { useDashboardPeriod } from '@/hooks/useDashboardPeriod';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { SalesFunnel } from '@/components/dashboard/SalesFunnel';
import { ViewsAndLeadsChart } from '@/components/dashboard/ViewsAndLeadsChart';
import { TopProductsList } from '@/components/dashboard/TopProductsList';
import { DashboardPeriodFilter } from '@/components/dashboard/DashboardPeriodFilter';

const PERIOD_STORAGE_KEY = 'vitrineturbo_reports_period';

export default function ReportsPage() {
  const [periodDays, setPeriodDays] = useDashboardPeriod(PERIOD_STORAGE_KEY);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Análise aprofundada do seu negócio</p>
        </div>
        <DashboardPeriodFilter value={periodDays} onChange={setPeriodDays} />
      </div>

      {/* Charts Row: Revenue Chart + Sales Funnel */}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <RevenueChart periodDays={periodDays} />
        <SalesFunnel periodDays={periodDays} />
      </div>

      {/* Views & Leads Chart */}
      <ViewsAndLeadsChart days={periodDays} />

      {/* Top Products */}
      <TopProductsList periodDays={periodDays} />
    </div>
  );
}
