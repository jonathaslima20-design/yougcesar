import { Bell, CheckCheck, Loader as Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationContext';
import NotificationItem from './NotificationItem';
import { Button } from '@/components/ui/button';
import type { AppNotification } from '@/types';

interface NotificationPanelProps {
  onClose?: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: AppNotification) => {
    onClose?.();
    if (notification.related_entity_type === 'order') {
      navigate('/dashboard/orders');
    } else if (notification.related_entity_type === 'product' && notification.related_entity_id) {
      navigate('/dashboard/listings');
    }
  };

  const handleViewAll = () => {
    onClose?.();
    navigate('/dashboard/notifications');
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Notificações</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground gap-1.5 px-2"
            onClick={markAllAsRead}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="max-h-[380px] overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Você receberá notificações sobre contatos, visualizações e sua assinatura.
            </p>
          </div>
        ) : (
          notifications.slice(0, 15).map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={markAsRead}
              onDelete={deleteNotification}
              onClick={handleNotificationClick}
            />
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="border-t px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-primary hover:text-primary"
            onClick={handleViewAll}
          >
            Ver todas as notificações
          </Button>
        </div>
      )}
    </div>
  );
}
