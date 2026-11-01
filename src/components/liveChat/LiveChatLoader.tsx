import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { hasUserChosen } from '@/lib/cookieConsent';
import {
  fetchPublicConfig,
  getStoredConversation,
  getStoredSession,
  getVisitorId,
  isChatDismissed,
  liveChatConfigured,
  sendHeartbeat,
  startVisitorSession,
  storeSession,
} from '@/lib/liveChat/visitorApi';
import type { LiveChatPublicConfig, VisitorSession } from '@/lib/liveChat/types';

const LiveChatWidget = lazy(() => import('./LiveChatWidget'));

const HEARTBEAT_MS = 30_000;
const MOBILE_QUERY = '(max-width: 767px)';

function whenIdleAfterLoad(cb: () => void): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    if (cancelled) return;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => !cancelled && cb(), { timeout: 4000 });
    } else {
      timeoutId = setTimeout(() => !cancelled && cb(), 2000);
    }
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', run);
    if (idleId !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    if (timeoutId) clearTimeout(timeoutId);
  };
}

function readUtm() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
  };
}

function referrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).host;
    return host === window.location.host ? null : host;
  } catch {
    return null;
  }
}

/**
 * Peça leve que fica no bundle da landing. Só depois do `load` + idle busca a
 * config, inicia a sessão anônima, roda o heartbeat (30 s, só com aba visível)
 * e, após o delay configurado, carrega o widget de chat em chunk separado.
 */
export default function LiveChatLoader() {
  const [config, setConfig] = useState<LiveChatPublicConfig | null>(null);
  const [session, setSession] = useState<VisitorSession | null>(null);
  const [chatAvailable, setChatAvailable] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const sectionRef = useRef<string | null>(null);
  const lastInteractionRef = useRef(Date.now());

  // 1. config + sessão
  useEffect(() => {
    if (!liveChatConfigured) return;
    let active = true;
    const cancel = whenIdleAfterLoad(async () => {
      try {
        const cfg = await fetchPublicConfig();
        if (!active || !cfg || (!cfg.tracking_enabled && !cfg.chat_available)) return;
        let sess = getStoredSession();
        if (!sess) {
          sess = await startVisitorSession({
            visitorId: getVisitorId(),
            path: window.location.pathname,
            referrerHost: referrerHost(),
            utm: readUtm(),
            device: window.matchMedia(MOBILE_QUERY).matches ? 'mobile' : 'desktop',
          });
          if (sess) storeSession(sess);
        }
        if (!active || !sess) return;
        setConfig(cfg);
        setChatAvailable(cfg.chat_available);
        setSession(sess);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[live-chat] init failed', err);
      }
    });
    return () => {
      active = false;
      cancel();
    };
  }, []);

  // 2. heartbeat + seção visível + interação
  useEffect(() => {
    if (!session || !config?.tracking_enabled) return;

    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };
    const opts = { passive: true } as const;
    window.addEventListener('pointerdown', markInteraction, opts);
    window.addEventListener('keydown', markInteraction, opts);
    window.addEventListener('scroll', markInteraction, opts);

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set((e.target as HTMLElement).id, e.intersectionRatio);
        let best: string | null = null;
        let bestRatio = 0;
        ratios.forEach((r, id) => {
          if (r > bestRatio) {
            best = id;
            bestRatio = r;
          }
        });
        if (best) sectionRef.current = best;
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    document.querySelectorAll<HTMLElement>('section[id], footer[id]').forEach((el) => observer.observe(el));

    const beat = async (ended = false) => {
      try {
        const res = await sendHeartbeat(
          session,
          {
            path: window.location.pathname,
            section: sectionRef.current,
            idleSeconds: (Date.now() - lastInteractionRef.current) / 1000,
            ended,
          },
          ended,
        );
        if (res && !ended) setChatAvailable(res.chat_available);
      } catch {
        // rede instável: tenta no próximo ciclo
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') beat();
    }, HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat();
    };
    const onPageHide = () => beat(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    beat();

    return () => {
      clearInterval(interval);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('scroll', markInteraction);
    };
  }, [session, config?.tracking_enabled]);

  // 3. timer de abertura (conta só tempo com aba visível)
  useEffect(() => {
    if (!session || !config || !chatAvailable || showWidget) return;
    if (!config.show_on_mobile && window.matchMedia(MOBILE_QUERY).matches) return;

    // conversa recente em andamento: mostra o launcher já
    if (getStoredConversation()) {
      setShowWidget(true);
      return;
    }
    if (isChatDismissed()) return;

    const delay = Math.max(0, config.open_delay_seconds ?? 25);
    let visibleSeconds = 0;
    const tick = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      visibleSeconds += 1;
      // não disputa espaço com o banner de cookies, mas não espera para sempre
      const bannerPending = !hasUserChosen() && visibleSeconds < delay * 3 + 10;
      if (visibleSeconds >= delay && !bannerPending) {
        clearInterval(tick);
        setShowWidget(true);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [session, config, chatAvailable, showWidget]);

  // fora do horário (ou chat desligado) nada aparece para o visitante
  if (!showWidget || !chatAvailable || !session || !config) return null;

  return (
    <Suspense fallback={null}>
      <LiveChatWidget config={config} session={session} />
    </Suspense>
  );
}
