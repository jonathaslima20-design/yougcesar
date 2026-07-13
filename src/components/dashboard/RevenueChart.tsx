import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader as Loader2 } from 'lucide-react';
import { useDashboardRevenue } from '@/hooks/useDashboardRevenue';

interface RevenueChartProps {
  periodDays?: number;
}

export function RevenueChart({ periodDays = 30 }: RevenueChartProps) {
  const { weeklyRevenue, loading } = useDashboardRevenue(periodDays);

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Receita</CardTitle>
        <p className="text-sm text-muted-foreground">Últimos {periodDays} dias</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[220px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyRevenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))',
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
              />
              <Bar
                dataKey="revenue"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
