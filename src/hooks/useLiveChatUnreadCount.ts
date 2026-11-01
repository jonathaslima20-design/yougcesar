import { useEffect, useState } from 'react';
import { fetchUnreadCount, subscribeAdminLiveChat } from '@/lib/liveChat/adminService';

/** Conversas com mensagens não lidas, para o badge do menu admin. */
export function useLiveChatUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      fetchUnreadCount().then(setCount).catch(() => undefined);
    };
    refresh();
    const unsubscribe = subscribeAdminLiveChat((evt) => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 500);
      if (
        evt.type === 'message' &&
        evt.message.sender === 'visitor' &&
        document.visibilityState !== 'visible' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('Nova mensagem no chat', { body: evt.message.body.slice(0, 120), tag: evt.conversation_id });
      }
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);

  return count;
}
