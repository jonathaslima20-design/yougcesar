import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Filter, Loader as Loader2, Trash2 } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchNotifications } from '@/lib/notificationService';
import NotificationItem from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AppNotification, NotificationType } from '@/types';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const TYPE_LABELS: Record<NotificationType | 'all', string> = {
  all: 'Todos os tipos',
  new_lead: 'Novos contatos',
  whatsapp_click: 'Cliques no WhatsApp',
  view_milestone: 'Marcos de visualizações',
  subscription_expiring: 'Assinatura expirando',
  subscription_expired: 'Assinatura expirada',
  product_sold: 'Vendas',
  new_order: 'Novos pedidos',
  system: 'Sistema',
};

const READ_FILTER_LABELS: Record<string, string> = {
  all: 'Todas',
  unread: 'Não lidas',
  read: 'Lidas',
};

interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

function groupByDate(notifications: AppNotification[]): NotificationGroup[] {
  const groups: Record<string, AppNotification[]> = {};
  const order: string[] = [];

  for (const n of notifications) {
    const date = new Date(n.created_at);
    let label: string;
    if (isToday(date)) label = 'Hoje';
    else if (isYesterday(date)) label = 'Ontem';
    else if (isThisWeek(date)) label = 'Esta semana';
    else label = format(date, "MMMM 'de' yyyy", { locale: ptBR });

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(n);
  }

  return order.map((label) => ({ label, items: groups[label] }));
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { markAsRead, markAllAsRead, deleteNotification, unreadCount, refresh } = useNotifications();
  const navigate = useNavigate();

  const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 30;

  const loadPage = useCallback(
    async (pageNum: number, replace = false) => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data, count } = await fetchNotifications(user.id, LIMIT, pageNum * LIMIT);
        setAllNotifications((prev) => (replace ? data : [...prev, ...data]));
        setHasMore((pageNum + 1) * LIMIT < (count || 0));
      } catch (err) {
        console.error('Failed to load notifications page:', err);
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    setPage(0);
    loadPage(0, true);
  }, [loadPage]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next);
  };

  const filtered = allNotifications.filter((n) => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (readFilter === 'unread' && n.is_read) return false;
    if (readFilter === 'read' && !n.is_read) return false;
    return true;
  });

  const groups = groupByDate(filtered);

  const handleItemRead = async (id: string) => {
    await markAsRead(id);
    setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleItemDelete = async (id: string) => {
    await deleteNotification(id);
    setAllNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setAllNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (notification.related_entity_type === 'order') {
      navigate('/dashboard/orders');
    } else if (notification.related_entity_type === 'product' && notification.related_entity_id) {
      navigate('/dashboard/listings');
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Notificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0
              ? `Você tem ${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}`
              : 'Todas as notificações estão lidas'}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as NotificationType | 'all')}>
          <SelectTrigger className="sm:w-[220px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(READ_FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && allNotifications.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">Nenhuma notificação encontrada</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
              {typeFilter !== 'all' || readFilter !== 'all'
                ? 'Tente alterar os filtros para ver mais notificações.'
                : 'Você receberá notificações sobre contatos, visualizações e sua assinatura.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {group.label}
              </p>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {group.items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onRead={handleItemRead}
                      onDelete={handleItemDelete}
                      onClick={handleNotificationClick}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
