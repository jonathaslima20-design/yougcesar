import { useState, useEffect } from 'react';
import { Eye, MousePointerClick, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAffiliateTeaserMonitoring, type AffiliateTeaserMonitoringRow } from '@/lib/monitoringService';

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

export default function AffiliateTeaserMonitoringPage() {
  const [rows, setRows] = useState<AffiliateTeaserMonitoringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAffiliateTeaserMonitoring();
        setRows(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setLoadError(msg);
        toast.error('Erro ao carregar monitoramento');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalViewed = rows.length;
  const totalClicked = rows.filter((r) => r.clicks_count > 0).length;
  const conversionRate = totalViewed > 0 ? (totalClicked / totalViewed) * 100 : 0;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Carregando monitoramento...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Monitoramento</h1>
        <p className="text-sm text-muted-foreground">
          Lojistas que visualizaram a oferta do módulo de Afiliados e cliques no CTA do WhatsApp
        </p>
      </div>

      {loadError && (
        <p className="text-sm text-destructive">{loadError}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Visualizaram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalViewed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointerClick className="w-4 h-4" />
              Clicaram no WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalClicked}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Taxa de conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5" />
            Lojistas ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Ninguém visualizou a oferta de afiliados ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Lojista</th>
                    <th className="text-right py-2 font-medium">Visualizações</th>
                    <th className="text-right py-2 font-medium">Cliques WhatsApp</th>
                    <th className="text-left py-2 font-medium">1ª visualização</th>
                    <th className="text-left py-2 font-medium">Última visualização</th>
                    <th className="text-left py-2 font-medium">Último clique</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.user_id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="font-medium">{r.user_name || r.user_email}</div>
                        {r.user_name && (
                          <div className="text-xs text-muted-foreground">{r.user_email}</div>
                        )}
                      </td>
                      <td className="text-right py-2">{r.views_count}</td>
                      <td className="text-right py-2">{r.clicks_count}</td>
                      <td className="py-2 text-xs text-muted-foreground">{formatDate(r.first_viewed_at)}</td>
                      <td className="py-2 text-xs text-muted-foreground">{formatDate(r.last_viewed_at)}</td>
                      <td className="py-2 text-xs text-muted-foreground">{formatDate(r.last_clicked_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
