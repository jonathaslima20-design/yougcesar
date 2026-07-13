import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Loader as Loader2, Receipt } from 'lucide-react';
import { useDashboardRevenue } from '@/hooks/useDashboardRevenue';

interface RevenueCardProps {
  periodDays?: number;
}

export function RevenueCard({ periodDays = 30 }: RevenueCardProps) {
  const { totalRevenue, revenueChange, averageTicket, totalDelivered, loading } = useDashboardRevenue(periodDays);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Faturamento ({periodDays}d)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="text-lg sm:text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <div className="flex items-center gap-1 mt-1">
                {revenueChange >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs font-medium ${revenueChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">vs período anterior</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="text-lg sm:text-2xl font-bold">{formatCurrency(averageTicket)}</div>
              <p className="text-xs text-muted-foreground">por pedido</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pedidos Entregues</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="text-2xl font-bold">{totalDelivered}</div>
              <p className="text-xs text-muted-foreground">nos últimos {periodDays} dias</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
