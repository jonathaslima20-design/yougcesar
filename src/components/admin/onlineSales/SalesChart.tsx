import { useMemo } from 'react';
import { format } from 'date-fns';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents, type DailyPoint } from '@/lib/adminOnlineSales';

interface SalesChartProps {
  daily: DailyPoint[];
  from: Date;
  to: Date;
}

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
const compactReais = (cents: number) => {
  const reais = cents / 100;
  return reais >= 1000 ? `R$ ${(reais / 1000).toFixed(1)}k` : `R$ ${reais.toFixed(0)}`;
};

export function SalesChart({ daily, from, to }: SalesChartProps) {
  // Days with no payments don't come back from the RPC — fill them with zeros so
  // the x axis is a real calendar and a quiet week doesn't look like a short one.
  const data = useMemo(() => {
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const points: { label: string; volume: number; fee: number }[] = [];
    const cursor = new Date(from);
    const last = new Date(Math.min(to.getTime(), Date.now()));
    while (cursor <= last && points.length < 400) {
      const d = byDay.get(format(cursor, 'yyyy-MM-dd'));
      points.push({ label: format(cursor, 'dd/MM'), volume: d?.approved_cents ?? 0, fee: d?.fee_cents ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }, [daily, from, to]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendas por dia</CardTitle>
        <CardDescription>Volume aprovado (barras) e o que ficou pra você de taxa (linha, eixo à direita).</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis yAxisId="left" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactReais} width={60} />
            <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactReais} width={60} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--popover-foreground))',
              }}
              formatter={(value: number, name: string) => [formatCents(value), name]}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="volume" name="Volume aprovado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Line yAxisId="right" dataKey="fee" name="Sua taxa" stroke="#16a34a" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
