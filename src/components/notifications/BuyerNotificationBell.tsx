import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBuyerNotifications } from '@/contexts/BuyerNotificationContext';
import { useBuyerStore } from '@/contexts/BuyerStoreContext';
import { supabaseBuyer } from '@/lib/supabaseBuyer';
import NotificationItem from './NotificationItem';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types';

export default function BuyerNotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { store, path } = useBuyerStore();
  const { notifications: allNotifications, loading, markAsRead, deleteNotification } = useBuyerNotifications();
  const [storeOrderIds, setStoreOrderIds] = useState<Set<string> | null>(null);

  // Notifications are stored per buyer identity (not per store), so keep only
  // the ones about orders placed in THIS store — the bell must never surface
  // activity from another store the buyer also shops at.
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    supabaseBuyer
      .from('orders')
      .select('id')
      .eq('store_owner_id', store.id)
      .then(({ data }) => {
        if (!cancelled) setStoreOrderIds(new Set((data || []).map((o: { id: string }) => o.id)));
      });
    return () => {
      cancelled = true;
    };
  }, [store, allNotifications.length]);

  const notifications = useMemo(
    () =>
      storeOrderIds
        ? allNotifications.filter(
            (n) => n.related_entity_type !== 'order' || (n.related_entity_id && storeOrderIds.has(n.related_entity_id))
          )
        : [],
    [allNotifications, storeOrderIds]
  );
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const markAllAsRead = () => notifications.filter((n) => !n.is_read).forEach((n) => markAsRead(n.id));

  const handleNotificationClick = (notification: AppNotification) => {
    setOpen(false);
    if (notification.related_entity_type === 'order' && notification.related_entity_id) {
      navigate(path(`/pedidos/${notification.related_entity_id}`));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-bold',
                unreadCount > 9 ? 'top-0 right-0 h-4 w-4 text-[9px]' : 'top-0.5 right-0.5 h-3.5 w-3.5 text-[9px]'
              )}
            >
              {unreadCount > 99 ? '99' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-2rem)] sm:w-[380px] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2" onClick={markAllAsRead}>
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
                Você será avisado quando o status dos seus pedidos mudar.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
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
      </PopoverContent>
    </Popover>
  );
}
