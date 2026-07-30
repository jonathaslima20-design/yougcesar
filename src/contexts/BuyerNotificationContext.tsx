import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { toast } from 'sonner';
import type { AppNotification } from '@/types';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
  subscribeToNotifications,
} from '@/lib/buyerNotificationService';

interface BuyerNotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const BuyerNotificationContext = createContext<BuyerNotificationContextType | undefined>(undefined);

export function BuyerNotificationProvider({ children }: { children: ReactNode }) {
  const { customer } = useBuyerAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof subscribeToNotifications> | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const [{ data }, count] = await Promise.all([
        fetchNotifications(customer.id, 15),
        fetchUnreadCount(customer.id),
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load buyer notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  const resyncUnreadCount = useCallback(async () => {
    if (!customer?.id) return;
    try {
      setUnreadCount(await fetchUnreadCount(customer.id));
    } catch (err) {
      console.error('Failed to refresh buyer unread count:', err);
    }
  }, [customer?.id]);

  useEffect(() => {
    if (!customer?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotifications();

    channelRef.current = subscribeToNotifications(customer.id, {
      onInsert: (newNotification) => {
        setNotifications((prev) => [newNotification, ...prev].slice(0, 15));
        setUnreadCount((prev) => prev + 1);
        toast(newNotification.title, { description: newNotification.message, duration: 5000 });
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
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [customer?.id, loadNotifications, resyncUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await markAsReadService(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark buyer notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!customer?.id) return;
    try {
      await markAllAsReadService(customer.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all buyer notifications as read:', err);
    }
  }, [customer?.id]);

  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        const target = notifications.find((n) => n.id === id);
        await deleteNotificationService(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (target && !target.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Failed to delete buyer notification:', err);
      }
    },
    [notifications]
  );

  return (
    <BuyerNotificationContext.Provider
      value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification }}
    >
      {children}
    </BuyerNotificationContext.Provider>
  );
}

export function useBuyerNotifications() {
  const context = useContext(BuyerNotificationContext);
  if (!context) {
    throw new Error('useBuyerNotifications must be used within a BuyerNotificationProvider');
  }
  return context;
}
