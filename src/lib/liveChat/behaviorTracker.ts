// Comportamento do visitante acumulado em memória e entregue no heartbeat de
// 30 s (sem requisições próprias). O servidor limita tudo de novo.

export interface BehaviorPayload {
  scrollPct: number | null;
  sections: { s: string; t: number }[];
  events: { k: 'click' | 'section'; l: string; ago: number }[];
}

const MAX_EVENTS_PER_SESSION = 40;
const SECTION_EVENT_MIN_MS = 1000;
const CLICKABLE = 'a, button, [role="button"], summary';

function clickLabel(el: HTMLElement): string {
  const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 60);
  const href = el.getAttribute('href');
  if (href) {
    try {
      return new URL(href, window.location.href).host || href.slice(0, 60);
    } catch {
      return href.slice(0, 60);
    }
  }
  return el.tagName.toLowerCase();
}

export function createBehaviorTracker(opts: { trackScroll: boolean; ignoreSelector?: string }) {
  let current: string | null = null;
  let since = performance.now();
  let visible = document.visibilityState === 'visible';
  // ms acumulados por seção desde o último envio, na ordem de entrada
  const pendingMs = new Map<string, number>();
  const enteredAt = new Map<string, number>();
  const announced = new Set<string>();
  let events: { k: 'click' | 'section'; l: string; at: number }[] = [];
  let eventsSent = 0;
  let maxScroll = 0;
  let sentScroll = 0;

  const pushEvent = (k: 'click' | 'section', l: string, at = Date.now()) => {
    if (eventsSent + events.length >= MAX_EVENTS_PER_SESSION) return;
    events.push({ k, l, at });
  };

  const accrue = () => {
    const now = performance.now();
    if (current && visible) {
      const ms = (pendingMs.get(current) ?? 0) + (now - since);
      pendingMs.set(current, ms);
      // a seção só entra na linha do tempo depois de 1 s visível
      if (!announced.has(current) && ms >= SECTION_EVENT_MIN_MS) {
        announced.add(current);
        pushEvent('section', current, enteredAt.get(current) ?? Date.now());
      }
    }
    since = now;
  };

  const measureScroll = () => {
    const doc = document.documentElement;
    if (doc.scrollHeight <= 0) return;
    const pct = Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100);
    if (pct > maxScroll) maxScroll = Math.min(100, pct);
  };

  const onScroll = () => measureScroll();
  const onVisibility = () => {
    accrue();
    visible = document.visibilityState === 'visible';
  };
  const onClick = (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target.closest<HTMLElement>(CLICKABLE) : null;
    if (!target || (opts.ignoreSelector && target.closest(opts.ignoreSelector))) return;
    pushEvent('click', clickLabel(target));
  };

  if (opts.trackScroll) {
    window.addEventListener('scroll', onScroll, { passive: true });
    measureScroll();
  }
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('click', onClick, { capture: true, passive: true });

  return {
    setSection(id: string | null) {
      if (id === current) return;
      accrue();
      current = id;
      if (id && !enteredAt.has(id)) enteredAt.set(id, Date.now());
    },

    /** Entrega o que mudou desde o último envio e zera o acumulado. */
    flush(): BehaviorPayload {
      accrue();
      const sections: BehaviorPayload['sections'] = [];
      pendingMs.forEach((ms, s) => {
        const t = Math.floor(ms / 1000);
        if (t <= 0) return;
        sections.push({ s, t });
        pendingMs.set(s, ms - t * 1000);
      });
      const now = Date.now();
      const out = events.map((ev) => ({ k: ev.k, l: ev.l, ago: Math.max(0, Math.round((now - ev.at) / 1000)) }));
      eventsSent += events.length;
      events = [];
      const scrollPct = opts.trackScroll && maxScroll > sentScroll ? maxScroll : null;
      if (scrollPct !== null) sentScroll = scrollPct;
      return { scrollPct, sections, events: out };
    },

    dispose() {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick, { capture: true });
    },
  };
}
