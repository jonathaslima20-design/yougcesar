import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasUserChosen } from '@/lib/cookieConsent';
import {
  fetchPublicConfig,
  getStoredConversation,
  getStoredSession,
  getVisitorId,
  isChatDismissed,
  liveChatConfigured,
  resumeVisitorSession,
  sendHeartbeat,
  startVisitorSession,
  storeConversation,
  storeSession,
} from '@/lib/liveChat/visitorApi';
import type { LiveChatPublicConfig, StoredConversation, VisitorSession } from '@/lib/liveChat/types';

const LiveChatWidget = lazy(() => import('./LiveChatWidget'));

const HEARTBEAT_MS = 30_000;
const MOBILE_QUERY = '(max-width: 767px)';

type WidgetMode = 'hidden' | 'launcher' | 'teaser';

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

function visibleSection(id: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(`section#${CSS.escape(id)}`)].find((el) => el.offsetHeight > 0) ?? null;
}

/**
 * Peça leve que fica no bundle da landing. Só depois do `load` + idle busca a
 * config, inicia a sessão anônima, roda o heartbeat (30 s, só com aba visível)
 * e, quando um gatilho dispara, carrega o widget de chat em chunk separado.
 */
export default function LiveChatLoader() {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<LiveChatPublicConfig | null>(null);
  const [session, setSession] = useState<VisitorSession | null>(null);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [chatAvailable, setChatAvailable] = useState(false);
  const [operatorOnline, setOperatorOnline] = useState(true);
  const [mode, setMode] = useState<WidgetMode>('hidden');
  const [proactive, setProactive] = useState<StoredConversation | null>(null);
  const [hasConversation, setHasConversation] = useState(() => !!getStoredConversation());
  const onConversationChange = useCallback((has: boolean) => setHasConversation(has), []);
  const sectionRef = useRef<string | null>(null);
  const lastInteractionRef = useRef(Date.now());

  // cliente com plano ativo não é lead: não oferece o chat (admin continua vendo para testar)
  const isActiveCustomer = !!user && user.role !== 'admin' && user.plan_status === 'active';
  const hiddenForCustomer = !!config?.hide_for_active_customers && isActiveCustomer;

  // 1. config + sessão
  useEffect(() => {
    if (!liveChatConfigured) return;
    let active = true;
    const cancel = whenIdleAfterLoad(async () => {
      try {
        const cfg = await fetchPublicConfig();
        if (!active || !cfg || (!cfg.tracking_enabled && !cfg.chat_enabled && !cfg.chat_available)) return;
        let sess = getStoredSession();
        if (sess) {
          // a persona pode ter sido cadastrada/trocada depois que a sessão começou
          try {
            const resumed = await resumeVisitorSession(sess);
            if (resumed) {
              sess = { ...sess, operator: resumed.operator };
              storeSession(sess);
            } else {
              sess = null;
              storeSession(null);
            }
          } catch {
            // RPC indisponível: segue com a sessão guardada
          }
        }
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
        setChatEnabled(cfg.chat_enabled ?? cfg.chat_available);
        setChatAvailable(cfg.chat_available);
        setOperatorOnline(cfg.operator_online ?? true);
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
        if (!res || ended) return;
        setChatAvailable(res.chat_available);
        if (res.chat_enabled !== undefined) setChatEnabled(res.chat_enabled);
        if (res.operator_online !== undefined) setOperatorOnline(res.operator_online);
        if (res.proactive) {
          const { force_open, ...delivered } = res.proactive;
          const conv: StoredConversation = { ...delivered, saved_at: Date.now() };
          storeConversation(conv);
          setHasConversation(true);
          setProactive({ ...conv, force_open });
        }
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

  // 3. gatilhos de abertura
  useEffect(() => {
    if (!session || !config || mode === 'teaser' || authLoading) return;
    if (!config.show_on_mobile && window.matchMedia(MOBILE_QUERY).matches) return;

    // conversa em andamento: launcher já, mesmo que o horário de novas conversas tenha acabado
    if (hasConversation) {
      setMode('launcher');
      return;
    }
    if (!chatAvailable || hiddenForCustomer) return;

    // sem abertura automática, ou fechado há pouco: só o botão, sem balão
    if (config.auto_open === false || isChatDismissed(config.reopen_cooldown_days ?? 1)) {
      setMode('launcher');
      return;
    }

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      setMode('teaser');
    };
    const cleanups: (() => void)[] = [];

    if (config.delay_trigger_enabled !== false) {
      const delay = Math.max(0, config.open_delay_seconds ?? 25);
      let visibleSeconds = 0;
      const tick = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        visibleSeconds += 1;
        // não disputa espaço com o banner de cookies, mas não espera para sempre
        const bannerPending = !hasUserChosen() && visibleSeconds < delay * 3 + 10;
        if (visibleSeconds >= delay && !bannerPending) fire();
      }, 1000);
      cleanups.push(() => clearInterval(tick));
    }

    if (config.trigger_section) {
      // a seção pode ser montada depois (preços dependem do país), então procura
      // a cada rolagem; dispara quando o topo dela passa de 60% da altura da tela
      const sectionId = config.trigger_section;
      let lastCheck = 0;
      const check = () => {
        const rect = visibleSection(sectionId)?.getBoundingClientRect();
        if (rect && rect.top < window.innerHeight * 0.6 && rect.bottom > 0) fire();
      };
      const onScroll = () => {
        const now = Date.now();
        if (now - lastCheck < 200) return;
        lastCheck = now;
        check();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      check();
      cleanups.push(() => window.removeEventListener('scroll', onScroll));
    }

    if (config.trigger_scroll_percent) {
      const threshold = config.trigger_scroll_percent / 100;
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0 && window.scrollY / max >= threshold) fire();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener('scroll', onScroll));
    }

    if (config.trigger_exit_intent && window.matchMedia('(pointer: fine)').matches) {
      const onLeave = (e: MouseEvent) => {
        if (!e.relatedTarget && e.clientY <= 0) fire();
      };
      document.addEventListener('mouseout', onLeave);
      cleanups.push(() => document.removeEventListener('mouseout', onLeave));
    }

    return () => cleanups.forEach((c) => c());
  }, [session, config, chatAvailable, hasConversation, hiddenForCustomer, mode, authLoading]);

  // conversa iniciada pelo admin aparece mesmo sem gatilho
  useEffect(() => {
    if (proactive && mode === 'hidden') setMode('teaser');
  }, [proactive, mode]);

  // novas conversas exigem chat disponível; a conversa em andamento só exige o chat ligado
  const visible = hasConversation ? chatEnabled : chatAvailable && !hiddenForCustomer;
  if (mode === 'hidden' || !visible || !session || !config) return null;

  return (
    <Suspense fallback={null}>
      <LiveChatWidget
        config={{ ...config, operator_online: operatorOnline }}
        session={session}
        initialView={mode === 'teaser' ? 'teaser' : 'closed'}
        proactive={proactive}
        onConversationChange={onConversationChange}
      />
    </Suspense>
  );
}
