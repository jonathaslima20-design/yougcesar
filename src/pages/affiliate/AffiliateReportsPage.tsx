import { useEffect, useMemo, useState } from 'react';
import { Loader } from 'lucide-react';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';
import { supabaseAffiliate } from '@/lib/supabaseAffiliate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ClickRow { created_at: string }
interface CommissionRow { created_at: string; commission_amount: number; product_name_snapshot: string | null }

export default function AffiliateReportsPage() {
  const { affiliate } = useAffiliateAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliate) return;
    const load = async () => {
      setLoading(true);
      try {
        const since = subDays(new Date(), rangeDays).toISOString();
        const [clicksRes, commissionsRes] = await Promise.all([
          supabaseAffiliate.from('affiliate_clicks').select('created_at').eq('affiliate_id', affiliate.id).gte('created_at', since),
          supabaseAffiliate.from('affiliate_commissions').select('created_at, commission_amount, product_name_snapshot').eq('affiliate_id', affiliate.id).gte('created_at', since),
        ]);
        setClicks(clicksRes.data || []);
        setCommissions(commissionsRes.data || []);
      } catch (err) {
        console.error('Error loading affiliate reports:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [affiliate, rangeDays]);

  const chartData = useMemo(() => {
    const days: { date: string; label: string; cliques: number; comissao: number }[] = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      days.push({ date: format(day, 'yyyy-MM-dd'), label: format(day, 'dd/MM'), cliques: 0, comissao: 0 });
    }
    const byDate = new Map(days.map(d => [d.date, d]));

    clicks.forEach(c => {
      const key = format(startOfDay(new Date(c.created_at)), 'yyyy-MM-dd');
      const entry = byDate.get(key);
      if (entry) entry.cliques += 1;
    });

    commissions.forEach(c => {
      const key = format(startOfDay(new Date(c.created_at)), 'yyyy-MM-dd');
      const entry = byDate.get(key);
      if (entry) entry.comissao += Number(c.commission_amount);
    });

    return days;
  }, [clicks, commissions, rangeDays]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    commissions.forEach(c => {
      const name = c.product_name_snapshot || 'Produto';
      map.set(name, (map.get(name) || 0) + Number(c.commission_amount));
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [commissions]);

  if (!affiliate) return null;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Cliques e comissões ao longo do tempo</p>
        </div>
        <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cliques por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.ceil(rangeDays / 10)} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="cliques" stroke="hsl(var(--primary))" name="Cliques" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comissão gerada por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.ceil(rangeDays / 10)} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="comissao" fill="hsl(var(--primary))" name="Comissão" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Produtos que mais renderam comissão</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma comissão no período selecionado.</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p) => {
                    const maxTotal = topProducts[0].total || 1;
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="truncate">{p.name}</span>
                          <span className="font-semibold shrink-0 ml-2">{formatCurrency(p.total)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.max(4, (p.total / maxTotal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
