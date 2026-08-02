import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { toast } from 'sonner';
import type { AppNotification } from '@/types';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
  subscribeToNotifications,
} from '@/lib/affiliateNotificationService';

interface AffiliateNotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const AffiliateNotificationContext = createContext<AffiliateNotificationContextType | undefined>(undefined);

export function AffiliateNotificationProvider({ children }: { children: ReactNode }) {
  const { affiliate } = useAffiliateAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof subscribeToNotifications> | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!affiliate?.id) return;
    setLoading(true);
    try {
      const [{ data }, count] = await Promise.all([
        fetchNotifications(affiliate.id, 15),
        fetchUnreadCount(affiliate.id),
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load affiliate notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [affiliate?.id]);

  const resyncUnreadCount = useCallback(async () => {
    if (!affiliate?.id) return;
    try {
      setUnreadCount(await fetchUnreadCount(affiliate.id));
    } catch (err) {
      console.error('Failed to refresh affiliate unread count:', err);
    }
  }, [affiliate?.id]);

  useEffect(() => {
    if (!affiliate?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    loadNotifications();

    channelRef.current = subscribeToNotifications(affiliate.id, {
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
  }, [affiliate?.id, loadNotifications, resyncUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await markAsReadService(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark affiliate notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!affiliate?.id) return;
    try {
      await markAllAsReadService(affiliate.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all affiliate notifications as read:', err);
    }
  }, [affiliate?.id]);

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
        console.error('Failed to delete affiliate notification:', err);
      }
    },
    [notifications]
  );

  return (
    <AffiliateNotificationContext.Provider
      value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification }}
    >
      {children}
    </AffiliateNotificationContext.Provider>
  );
}

export function useAffiliateNotifications() {
  const context = useContext(AffiliateNotificationContext);
  if (!context) {
    throw new Error('useAffiliateNotifications must be used within an AffiliateNotificationProvider');
  }
  return context;
}
