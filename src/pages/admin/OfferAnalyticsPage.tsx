import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, MousePointerClick, CircleCheck as CheckCircle, Circle as XCircle, TrendingUp, Users, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  fetchOfferById,
  fetchOfferAnalytics,
  fetchOfferRecipients,
  fetchOfferUserTimeline,
} from '@/lib/offerService';
import type {
  OfferWithConfig,
  OfferAnalytics,
  OfferRecipientSummary,
  OfferTimelineEvent,
  OfferAssignmentStatus,
} from '@/types/offers';

const STATUS_LABELS: Record<OfferAssignmentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  visualizada: { label: 'Visualizada', variant: 'secondary' },
  aceita: { label: 'Aceita', variant: 'default' },
  dispensada: { label: 'Dispensada', variant: 'destructive' },
  expirada: { label: 'Expirada', variant: 'outline' },
};

function timelineLabel(event: OfferTimelineEvent): string {
  switch (event.type) {
    case 'assigned': return 'Atribuida ao usuario';
    case 'exibida': return 'Oferta exibida';
    case 'clicada': return 'Clicou em aproveitar';
    case 'fechada': return 'Fechou a oferta';
    case 'convertida': return 'Conversao registrada';
    case 'status': return `Status: ${event.status ?? ''}`;
    default: return event.type;
  }
}

function timelineColor(event: OfferTimelineEvent): string {
  switch (event.type) {
    case 'assigned': return 'bg-blue-500';
    case 'exibida': return 'bg-amber-500';
    case 'clicada': return 'bg-orange-500';
    case 'fechada': return 'bg-rose-500';
    case 'convertida': return 'bg-emerald-500';
    case 'status': return 'bg-slate-400';
    default: return 'bg-muted-foreground';
  }
}

export default function OfferAnalyticsPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<OfferWithConfig | null>(null);
  const [analytics, setAnalytics] = useState<OfferAnalytics | null>(null);
  const [recipients, setRecipients] = useState<OfferRecipientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineUser, setTimelineUser] = useState<OfferRecipientSummary | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<OfferTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    if (!offerId) return;
    const load = async () => {
      try {
        const [offerData, analyticsData, recipientData] = await Promise.all([
          fetchOfferById(offerId),
          fetchOfferAnalytics(offerId, 30),
          fetchOfferRecipients(offerId),
        ]);
        setOffer(offerData);
        setAnalytics(analyticsData);
        setRecipients(recipientData);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setLoadError(msg);
        toast.error('Erro ao carregar analytics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [offerId]);

  const openTimeline = async (recipient: OfferRecipientSummary) => {
    if (!offerId) return;
    setTimelineUser(recipient);
    setTimelineOpen(true);
    setTimelineLoading(true);
    try {
      const events = await fetchOfferUserTimeline(offerId, recipient.user_id);
      setTimelineEvents(events);
    } catch (err) {
      toast.error('Erro ao carregar historico do usuario');
      console.error(err);
    } finally {
      setTimelineLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Carregando analytics...
        </div>
      </div>
    );
  }

  if (loadError || !offer || !analytics) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/offers')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Analytics</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
          <p className="text-base font-medium">
            {loadError ? 'Erro ao carregar analytics' : 'Oferta nao encontrada'}
          </p>
          {loadError && (
            <p className="text-sm text-destructive max-w-md text-center">{loadError}</p>
          )}
          <Button variant="outline" onClick={() => navigate('/admin/offers')}>
            Voltar para ofertas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/offers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Analytics: {offer.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            Metricas dos ultimos 30 dias
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Impressoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.total_impressions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointerClick className="w-4 h-4" />
              Cliques (CTR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.total_clicks}</p>
            <p className="text-xs text-muted-foreground">{analytics.ctr.toFixed(1)}% taxa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Conversoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.total_conversions}</p>
            <p className="text-xs text-muted-foreground">{analytics.conversion_rate.toFixed(1)}% taxa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Dispensadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.total_dismissals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Funil de Conversao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <FunnelStep
              label="Impressoes"
              value={analytics.total_impressions}
              percentage={100}
              color="bg-blue-500"
            />
            <FunnelStep
              label="Cliques"
              value={analytics.total_clicks}
              percentage={analytics.total_impressions > 0 ? (analytics.total_clicks / analytics.total_impressions) * 100 : 0}
              color="bg-amber-500"
            />
            <FunnelStep
              label="Conversoes"
              value={analytics.total_conversions}
              percentage={analytics.total_impressions > 0 ? (analytics.total_conversions / analytics.total_impressions) * 100 : 0}
              color="bg-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Daily Data */}
      {analytics.daily_data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historico Diario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Data</th>
                    <th className="text-right py-2 font-medium">Impressoes</th>
                    <th className="text-right py-2 font-medium">Cliques</th>
                    <th className="text-right py-2 font-medium">Conversoes</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.daily_data.map((day) => (
                    <tr key={day.date} className="border-b last:border-0">
                      <td className="py-2">{new Date(day.date).toLocaleDateString('pt-BR')}</td>
                      <td className="text-right py-2">{day.impressions}</td>
                      <td className="text-right py-2">{day.clicks}</td>
                      <td className="text-right py-2">{day.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5" />
            Destinatarios ({recipients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum usuario recebeu esta oferta ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Usuario</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Vis.</th>
                    <th className="text-right py-2 font-medium">Cliques</th>
                    <th className="text-right py-2 font-medium">Conv.</th>
                    <th className="text-right py-2 font-medium">Disp.</th>
                    <th className="text-left py-2 font-medium">Atribuida em</th>
                    <th className="text-right py-2 font-medium">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => {
                    const status = STATUS_LABELS[r.status];
                    return (
                      <tr key={r.assignment_id} className="border-b last:border-0">
                        <td className="py-2">
                          <div className="font-medium">{r.user_name || r.user_email}</div>
                          {r.user_name && (
                            <div className="text-xs text-muted-foreground">{r.user_email}</div>
                          )}
                        </td>
                        <td className="py-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="text-right py-2">{r.views_count}</td>
                        <td className="text-right py-2">{r.clicks_count}</td>
                        <td className="text-right py-2">{r.conversions_count}</td>
                        <td className="text-right py-2">{r.dismissals_count}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {new Date(r.assigned_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="text-right py-2">
                          <Button variant="ghost" size="sm" onClick={() => openTimeline(r)}>
                            <Activity className="w-4 h-4 mr-1" />
                            Historico
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Historico - {timelineUser?.user_name || timelineUser?.user_email}
            </DialogTitle>
          </DialogHeader>
          {timelineLoading ? (
            <p className="py-6 text-sm text-muted-foreground text-center">Carregando...</p>
          ) : timelineEvents.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              Nenhuma atividade registrada.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {timelineEvents.map((event, idx) => (
                <div key={`${event.type}-${event.at}-${idx}`} className="flex gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${timelineColor(event)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{timelineLabel(event)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleString('pt-BR')}
                    </div>
                    {event.context && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {Object.entries(event.context).map(([k, v]) => (
                          <span key={k} className="mr-2">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FunnelStep({ label, value, percentage, color }: { label: string; value: number; percentage: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(percentage, 2)}%` }} />
      </div>
    </div>
  );
}
