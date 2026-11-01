import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type {
  AdminChatMessageRow,
  ChatConversationRow,
  LiveChatOperatorRow,
  LiveChatPublicConfig,
  LiveChatSettings,
  VisitorSessionRow,
} from './types';

// ─── Configurações ──────────────────────────────────────────────────────────

export async function fetchLiveChatSettings(): Promise<LiveChatSettings> {
  const { data, error } = await supabase.from('live_chat_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data as LiveChatSettings;
}

export async function updateLiveChatSettings(patch: Partial<Omit<LiveChatSettings, 'id' | 'updated_at'>>) {
  const { error } = await supabase
    .from('live_chat_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
}

export async function fetchPublicStatus(): Promise<LiveChatPublicConfig> {
  const { data, error } = await supabase.rpc('get_live_chat_public_config');
  if (error) throw error;
  return data as LiveChatPublicConfig;
}

export async function runCleanupNow() {
  const { error } = await supabase.rpc('admin_live_chat_cleanup_now');
  if (error) throw error;
}

// ─── Operadores ─────────────────────────────────────────────────────────────

export async function fetchOperators(): Promise<LiveChatOperatorRow[]> {
  const { data, error } = await supabase
    .from('live_chat_operators')
    .select('id, display_name, role_title, avatar_url, is_active, weight, created_at')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as LiveChatOperatorRow[];
}

export async function saveOperator(op: Partial<LiveChatOperatorRow> & { display_name: string; role_title: string }) {
  const payload = {
    display_name: op.display_name,
    role_title: op.role_title,
    avatar_url: op.avatar_url ?? null,
    is_active: op.is_active ?? true,
    weight: op.weight ?? 1,
    updated_at: new Date().toISOString(),
  };
  const query = op.id
    ? supabase.from('live_chat_operators').update(payload).eq('id', op.id)
    : supabase.from('live_chat_operators').insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteOperator(id: string) {
  const { error } = await supabase.from('live_chat_operators').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadOperatorAvatar(file: File): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('live-chat-avatars')
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return supabase.storage.from('live-chat-avatars').getPublicUrl(path).data.publicUrl;
}

// ─── Visitantes ao vivo ─────────────────────────────────────────────────────

export const LIVE_WINDOW_SECONDS = 90;

export interface LiveVisitor extends VisitorSessionRow {
  operator: { display_name: string } | null;
  conversations: { id: string; status: string }[];
}

export async function fetchLiveVisitors(): Promise<LiveVisitor[]> {
  const since = new Date(Date.now() - LIVE_WINDOW_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select(
      'id, visitor_id, operator_id, started_at, last_seen_at, last_interaction_at, current_path, current_section, sections_seen, referrer_host, utm_source, utm_medium, utm_campaign, device, visit_number, ended_at, operator:live_chat_operators(display_name), conversations:chat_conversations(id, status)',
    )
    .is('ended_at', null)
    .gte('last_seen_at', since)
    .order('started_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as LiveVisitor[];
}

export async function fetchVisitorSession(id: string): Promise<VisitorSessionRow | null> {
  const { data, error } = await supabase.from('visitor_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as VisitorSessionRow | null;
}

// ─── Conversas ──────────────────────────────────────────────────────────────

export interface ConversationListItem extends ChatConversationRow {
  operator: { display_name: string; role_title: string; avatar_url: string | null } | null;
}

export async function fetchConversations(scope: 'active' | 'closed'): Promise<ConversationListItem[]> {
  let query = supabase
    .from('chat_conversations')
    .select('*, operator:live_chat_operators(display_name, role_title, avatar_url)')
    .order('last_message_at', { ascending: false })
    .limit(100);
  query = scope === 'active' ? query.in('status', ['open', 'pending']) : query.eq('status', 'closed');
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ConversationListItem[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('chat_conversations')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'pending'])
    .gt('unread_for_admin', 0);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchMessages(conversationId: string): Promise<AdminChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender, admin_user_id, body, kind, created_at')
    .eq('conversation_id', conversationId)
    .order('id')
    .limit(500);
  if (error) throw error;
  return (data ?? []) as AdminChatMessageRow[];
}

export async function sendOperatorMessage(conversationId: string, adminUserId: string, body: string) {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, sender: 'operator', admin_user_id: adminUserId, body: body.trim(), kind: 'text' });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string) {
  const { error } = await supabase.from('chat_conversations').update({ unread_for_admin: 0 }).eq('id', conversationId);
  if (error) throw error;
}

export async function setConversationStatus(conversationId: string, status: 'open' | 'pending' | 'closed') {
  const { error } = await supabase
    .from('chat_conversations')
    .update({ status, closed_at: status === 'closed' ? new Date().toISOString() : null })
    .eq('id', conversationId);
  if (error) throw error;
}

export async function deleteConversation(conversationId: string) {
  const { error } = await supabase.from('chat_conversations').delete().eq('id', conversationId);
  if (error) throw error;
}

// ─── Realtime do admin: um único canal privado compartilhado ────────────────

export type AdminLiveChatEvent =
  | { type: 'message'; conversation_id: string; message: AdminChatMessageRow }
  | { type: 'conversation'; conversation_id: string; status: string; whatsapp_e164: string | null };

type Listener = (event: AdminLiveChatEvent) => void;

const listeners = new Set<Listener>();
let adminChannel: RealtimeChannel | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retries = 0;
const MAX_RETRIES = 5;

let connecting = false;

async function connectAdminChannel() {
  if (connecting || adminChannel) return;
  connecting = true;
  try {
    // O canal é privado: se assinar antes da sessão ser restaurada, entra como
    // anon e o Realtime recusa ("Unauthorized"). Garante o JWT antes.
    const { data } = await supabase.auth.getSession();
    if (!data.session || listeners.size === 0 || adminChannel) return;
    await supabase.realtime.setAuth(data.session.access_token);
    subscribeChannel();
  } finally {
    connecting = false;
  }
}

function subscribeChannel() {
  const channel = supabase
    .channel('admin:live-chat', { config: { private: true } })
    .on('broadcast', { event: 'message' }, ({ payload }) => {
      const evt = { type: 'message', ...payload } as AdminLiveChatEvent;
      listeners.forEach((l) => l(evt));
    })
    .on('broadcast', { event: 'conversation' }, ({ payload }) => {
      const evt = { type: 'conversation', ...payload } as AdminLiveChatEvent;
      listeners.forEach((l) => l(evt));
    });
  adminChannel = channel;
  channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      retries = 0;
      return;
    }
    if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && adminChannel === channel) {
      if (import.meta.env.DEV) console.warn('[live-chat admin]', status, err);
      supabase.removeChannel(channel);
      adminChannel = null;
      if (retries < MAX_RETRIES && listeners.size > 0) {
        retries += 1;
        retryTimer = setTimeout(connectAdminChannel, 3000 * retries);
      }
    }
  });
}

export function subscribeAdminLiveChat(listener: Listener): () => void {
  listeners.add(listener);
  if (!adminChannel) connectAdminChannel();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(retryTimer);
      retries = 0;
      if (adminChannel) {
        supabase.removeChannel(adminChannel);
        adminChannel = null;
      }
    }
  };
}
