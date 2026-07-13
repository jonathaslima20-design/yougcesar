import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader as Loader2, MessageSquare, ShoppingBag, Eye, ArrowRight } from 'lucide-react';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useNavigate } from 'react-router-dom';

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `ha ${diffMin}min`;
  if (diffHours < 24) return `ha ${diffHours}h`;
  if (diffDays < 7) return `ha ${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function RecentActivityFeed() {
  const { events, pendingOrders, loading } = useRecentActivity();
  const navigate = useNavigate();

  if (!loading && events.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'lead': return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
      case 'order': return <ShoppingBag className="h-4 w-4 text-muted-foreground" />;
      case 'view_milestone': return <Eye className="h-4 w-4 text-muted-foreground" />;
      default: return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Atividade Recente</CardTitle>
            <p className="text-sm text-muted-foreground">Ultimos eventos da sua vitrine</p>
          </div>
          {pendingOrders > 0 && (
            <button
              onClick={() => navigate('/dashboard/orders')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
            >
              <ShoppingBag className="h-3 w-3" />
              {pendingOrders} pendente{pendingOrders > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(event => (
              <div key={event.id} className="flex items-start gap-3 py-1.5">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {getIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {getRelativeTime(event.timestamp)}
                </span>
              </div>
            ))}

            {events.length > 0 && (
              <button
                onClick={() => navigate('/dashboard/notifications')}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline pt-2"
              >
                Ver todas as notificacoes
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
