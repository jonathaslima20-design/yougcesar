import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { toast } from 'sonner';
import type { AppNotification } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
  subscribeToNotifications,
} from '@/lib/notificationService';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATION_TITLES: Record<string, string> = {
  new_lead: 'Novo contato',
  whatsapp_click: 'WhatsApp',
  view_milestone: 'Visualizações',
  subscription_expiring: 'Assinatura',
  subscription_expired: 'Assinatura',
  product_sold: 'Venda',
  new_order: 'Novo pedido',
  low_stock: 'Estoque baixo',
  out_of_stock: 'Produto esgotado',
  system: 'Sistema',
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof subscribeToNotifications> | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [{ data }, count] = await Promise.all([
        fetchNotifications(user.id, 30),
        fetchUnreadCount(user.id),
      ]);
      setNotifications(data);
      setUnreadCount(count);
      setError(null);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Não foi possível carregar suas notificações agora.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Re-syncs the unread count from the server rather than adjusting it locally,
  // so a read/delete made on another tab or device can't cause it to drift.
  const resyncUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const count = await fetchUnreadCount(user.id);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to refresh unread count:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      return;
    }

    loadNotifications();

    channelRef.current = subscribeToNotifications(user.id, {
      onInsert: (newNotification) => {
        setNotifications((prev) => [newNotification, ...prev].slice(0, 30));
        setUnreadCount((prev) => prev + 1);

        toast(newNotification.title, {
          description: newNotification.message,
          duration: 5000,
        });
      },
      onUpdate: (updated) => {
        setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        resyncUnreadCount();
      },
      onDelete: (deletedId) => {
        setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
        resyncUnreadCount();
      },
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [user?.id, loadNotifications, resyncUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await markAsReadService(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      await markAllAsReadService(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [user?.id]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const target = notifications.find((n) => n.id === id);
      await deleteNotificationService(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refresh: loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
