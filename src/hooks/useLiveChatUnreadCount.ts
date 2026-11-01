import { useEffect, useState } from 'react';
import { fetchUnreadCount, pingAdminPresence, subscribeAdminLiveChat } from '@/lib/liveChat/adminService';

const PING_MS = 60_000;
const SOUND_KEY = 'vt_lc_sound';

export function isLiveChatSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setLiveChatSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // ignore
  }
}

const READ_EVENT = 'livechat:read';

/** Avisa o contador do menu/título que uma conversa foi lida. */
export function notifyLiveChatRead() {
  window.dispatchEvent(new Event(READ_EVENT));
}

let audioCtx: AudioContext | null = null;

/** Bipe curto gerado na hora (sem arquivo de áudio). */
export function playLiveChatChime() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.2);
    });
  } catch {
    // navegador sem áudio ou sem interação prévia
  }
}

/**
 * Conversas com mensagens não lidas (badge do menu), presença do atendente
 * (ping a cada 60 s enquanto o painel admin está aberto), som, notificação do
 * navegador e contador no título da aba.
 */
export function useLiveChatUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      fetchUnreadCount().then(setCount).catch(() => undefined);
    };
    refresh();
    window.addEventListener(READ_EVENT, refresh);

    const ping = () => pingAdminPresence().catch(() => undefined);
    ping();
    const pingInterval = setInterval(ping, PING_MS);

    const unsubscribe = subscribeAdminLiveChat((evt) => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 500);
      if (evt.type !== 'message' || evt.message.sender !== 'visitor') return;

      const viewingThis =
        document.visibilityState === 'visible' &&
        window.location.pathname === '/admin/live-chat' &&
        new URLSearchParams(window.location.search).get('c') === evt.conversation_id;
      if (viewingThis) return;

      if (isLiveChatSoundEnabled()) playLiveChatChime();
      if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('Nova mensagem no chat', {
          body: evt.message.kind === 'whatsapp' ? 'Visitante informou o WhatsApp' : evt.message.body.slice(0, 120),
          tag: evt.conversation_id,
        });
        n.onclick = () => {
          window.focus();
          window.location.href = `/admin/live-chat?c=${evt.conversation_id}`;
        };
      }
    });
    return () => {
      clearTimeout(timer);
      clearInterval(pingInterval);
      window.removeEventListener(READ_EVENT, refresh);
      unsubscribe();
    };
  }, [enabled]);

  // contador no título da aba
  useEffect(() => {
    if (!enabled) return;
    const strip = (t: string) => t.replace(/^\(\d+\)\s/, '');
    document.title = count > 0 ? `(${count}) ${strip(document.title)}` : strip(document.title);
  }, [count, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      document.title = document.title.replace(/^\(\d+\)\s/, '');
    };
  }, [enabled]);

  return count;
}
