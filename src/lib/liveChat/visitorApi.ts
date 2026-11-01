import type { ChatMessage, LiveChatPublicConfig, StoredConversation, VisitorSession } from './types';

// O visitante fala com o banco por fetch puro com a anon key: não toca nos
// clientes Supabase autenticados (merchant/buyer) e permite `keepalive` no
// heartbeat de saída da página.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const liveChatConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export async function visitorRpc<T>(fn: string, args: Record<string, unknown> = {}, keepalive = false): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    keepalive,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `${fn} failed (${res.status})`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export function getRealtimeEndpoint() {
  return {
    url: `${SUPABASE_URL!.replace(/^http/, 'ws')}/realtime/v1`,
    apiKey: SUPABASE_ANON_KEY!,
  };
}

// ─── Armazenamento local (sempre em try/catch: modo privado pode bloquear) ──

const VISITOR_KEY = 'vt_vid';
const SESSION_KEY = 'vt_sess';
const CONVERSATION_KEY = 'vt_chat';
const DISMISSED_KEY = 'vt_chat_dismissed';
const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string | null) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getVisitorId(): string {
  const existing = safeGet(localStorage, VISITOR_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id = crypto.randomUUID();
  safeSet(localStorage, VISITOR_KEY, id);
  return id;
}

export function getStoredSession(): VisitorSession | null {
  const raw = safeGet(sessionStorage, SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VisitorSession;
  } catch {
    return null;
  }
}

export function storeSession(session: VisitorSession | null) {
  safeSet(sessionStorage, SESSION_KEY, session ? JSON.stringify(session) : null);
}

export function getStoredConversation(): StoredConversation | null {
  const raw = safeGet(localStorage, CONVERSATION_KEY);
  if (!raw) return null;
  try {
    const conv = JSON.parse(raw) as StoredConversation;
    if (Date.now() - conv.saved_at > CONVERSATION_TTL_MS) {
      safeSet(localStorage, CONVERSATION_KEY, null);
      return null;
    }
    return conv;
  } catch {
    return null;
  }
}

export function storeConversation(conv: StoredConversation | null) {
  safeSet(localStorage, CONVERSATION_KEY, conv ? JSON.stringify(conv) : null);
}

export function isChatDismissed(): boolean {
  return safeGet(sessionStorage, DISMISSED_KEY) === '1';
}

export function setChatDismissed() {
  safeSet(sessionStorage, DISMISSED_KEY, '1');
}

// ─── RPCs ───────────────────────────────────────────────────────────────────

export function fetchPublicConfig() {
  return visitorRpc<LiveChatPublicConfig>('get_live_chat_public_config');
}

export function startVisitorSession(args: {
  visitorId: string;
  path: string;
  referrerHost: string | null;
  utm: { source: string | null; medium: string | null; campaign: string | null };
  device: 'mobile' | 'desktop';
}) {
  return visitorRpc<VisitorSession | null>('visitor_session_start', {
    p_visitor_id: args.visitorId,
    p_path: args.path,
    p_referrer_host: args.referrerHost,
    p_utm_source: args.utm.source,
    p_utm_medium: args.utm.medium,
    p_utm_campaign: args.utm.campaign,
    p_device: args.device,
  });
}

export function sendHeartbeat(
  session: VisitorSession,
  data: { path: string; section: string | null; idleSeconds: number; ended?: boolean },
  keepalive = false,
) {
  return visitorRpc<{ tracking_enabled: boolean; chat_available: boolean }>(
    'visitor_heartbeat',
    {
      p_session_id: session.session_id,
      p_token: session.token,
      p_path: data.path,
      p_section: data.section,
      p_idle_seconds: Math.round(data.idleSeconds),
      p_ended: data.ended ?? false,
    },
    keepalive,
  );
}

export function openConversation(session: VisitorSession) {
  return visitorRpc<{ conversation_id: string; channel_key: string; token: string }>('chat_open_conversation', {
    p_session_id: session.session_id,
    p_token: session.token,
  });
}

export function sendVisitorMessage(conv: StoredConversation, body: string, kind: 'text' | 'quick_reply', greeting?: string) {
  return visitorRpc<{ id: number; created_at: string }>('chat_send_visitor_message', {
    p_conversation_id: conv.conversation_id,
    p_token: conv.token,
    p_body: body,
    p_kind: kind,
    p_greeting: greeting ?? null,
  });
}

export function submitWhatsapp(conv: StoredConversation, phone: string) {
  return visitorRpc<{ whatsapp: string }>('chat_submit_whatsapp', {
    p_conversation_id: conv.conversation_id,
    p_token: conv.token,
    p_phone: phone,
  });
}

export function fetchConversationMessages(conv: StoredConversation, afterId = 0) {
  return visitorRpc<ChatMessage[]>('chat_fetch_messages', {
    p_conversation_id: conv.conversation_id,
    p_token: conv.token,
    p_after_id: afterId,
  });
}

export function forgetConversation(conv: StoredConversation) {
  return visitorRpc<null>('visitor_forget_conversation', {
    p_conversation_id: conv.conversation_id,
    p_token: conv.token,
  });
}
