import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type {
  AdminChatMessageRow,
  CannedReply,
  LandingVisitMetrics,
  LiveChatAdminStatus,
  LiveChatMetrics,
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
    .select('id, display_name, role_title, avatar_url, greeting_template, is_active, weight, created_at')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as LiveChatOperatorRow[];
}

export async function saveOperator(op: Partial<LiveChatOperatorRow> & { display_name: string; role_title: string }) {
  const payload = {
    display_name: op.display_name,
    role_title: op.role_title,
    avatar_url: op.avatar_url ?? null,
    greeting_template: op.greeting_template?.trim() || null,
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
      'id, visitor_id, operator_id, started_at, last_seen_at, last_interaction_at, current_path, current_section, sections_seen, referrer_host, utm_source, utm_medium, utm_campaign, device, visit_number, ended_at, greeting_shown_at, operator:live_chat_operators(display_name), conversations:chat_conversations(id, status)',
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

// ─── Status, presença e controles ───────────────────────────────────────────

export async function fetchAdminStatus(): Promise<LiveChatAdminStatus> {
  // quem está olhando o status está no painel: registra a presença antes,
  // senão a tela abre mostrando "ausente" até o próximo ping
  await pingAdminPresence().catch(() => undefined);
  const { data, error } = await supabase.rpc('admin_live_chat_status');
  if (error) throw error;
  return data as LiveChatAdminStatus;
}

/** "Visto por último" do atendente; sem ping há 3 min o chat fica como ausente. */
export async function pingAdminPresence() {
  const { error } = await supabase.rpc('admin_live_chat_ping');
  if (error) throw error;
}

export const STATE_LABELS: Record<LiveChatAdminStatus['state'], string> = {
  off: 'Chat desligado',
  paused: 'Pausado',
  holiday: 'Feriado (fechado)',
  closed_hours: 'Fora do horário',
  away: 'Atendente ausente',
  online: 'Online',
};

export function describeStatus(status: LiveChatAdminStatus): string {
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  switch (status.state) {
    case 'off':
      return 'Visitantes não veem o chat. Ligue em "Chat na landing page".';
    case 'paused':
      return `Pausado até ${when(status.paused_until)}. Conversas em andamento continuam.`;
    case 'holiday':
    case 'closed_hours':
      return status.next_open_at ? `Abre ${when(status.next_open_at)}. Conversas em andamento continuam.` : 'Nenhum horário de abertura nos próximos 14 dias.';
    case 'away':
      return status.away_behavior === 'hide'
        ? 'Você está ausente: o chat está escondido para novos visitantes.'
        : 'Você está ausente: o chat pede o WhatsApp do visitante em vez de prometer resposta.';
    default:
      return 'Visitantes veem o chat e você aparece como online.';
  }
}

// ─── Respostas prontas ──────────────────────────────────────────────────────

export async function fetchCannedReplies(): Promise<CannedReply[]> {
  const { data, error } = await supabase
    .from('live_chat_canned_replies')
    .select('id, title, body, sort_order')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as CannedReply[];
}

export async function saveCannedReply(reply: Partial<CannedReply> & { title: string; body: string }) {
  const payload = { title: reply.title.trim(), body: reply.body.trim(), sort_order: reply.sort_order ?? 0 };
  const query = reply.id
    ? supabase.from('live_chat_canned_replies').update(payload).eq('id', reply.id)
    : supabase.from('live_chat_canned_replies').insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteCannedReply(id: string) {
  const { error } = await supabase.from('live_chat_canned_replies').delete().eq('id', id);
  if (error) throw error;
}

// ─── Bloqueio, contato e conversa proativa ──────────────────────────────────

export interface BlockedVisitor {
  visitor_id: string;
  reason: string | null;
  blocked_at: string;
}

export async function fetchBlockedVisitors(): Promise<BlockedVisitor[]> {
  const { data, error } = await supabase
    .from('live_chat_blocked_visitors')
    .select('visitor_id, reason, blocked_at')
    .order('blocked_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlockedVisitor[];
}

export async function blockVisitor(visitorId: string, adminUserId: string, reason: string | null, conversationId?: string) {
  const { error } = await supabase
    .from('live_chat_blocked_visitors')
    .upsert({ visitor_id: visitorId, blocked_by: adminUserId, reason });
  if (error) throw error;
  if (conversationId) await setConversationStatus(conversationId, 'closed');
}

export async function unblockVisitor(visitorId: string) {
  const { error } = await supabase.from('live_chat_blocked_visitors').delete().eq('visitor_id', visitorId);
  if (error) throw error;
}

export async function setConversationContacted(conversationId: string, contacted: boolean) {
  const { error } = await supabase
    .from('chat_conversations')
    .update({ contacted_at: contacted ? new Date().toISOString() : null })
    .eq('id', conversationId);
  if (error) throw error;
}

export async function startConversation(
  sessionId: string,
  message: string,
  forceOpen = false,
): Promise<{ conversation_id: string; existing: boolean }> {
  const { data, error } = await supabase.rpc('admin_start_conversation', {
    p_session_id: sessionId,
    p_message: message,
    p_force_open: forceOpen,
  });
  if (error) throw error;
  return data as { conversation_id: string; existing: boolean };
}

// ─── Métricas e exportação ──────────────────────────────────────────────────

export async function fetchMetrics(days: number): Promise<LiveChatMetrics> {
  const { data, error } = await supabase.rpc('admin_live_chat_metrics', { p_days: days });
  if (error) throw error;
  return data as LiveChatMetrics;
}

export async function exportWhatsappLeadsCsv(): Promise<number> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('whatsapp_e164, whatsapp_consent_at, contacted_at, status, source, utm_campaign, created_at, operator:live_chat_operators(display_name)')
    .not('whatsapp_e164', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    whatsapp_e164: string;
    whatsapp_consent_at: string | null;
    contacted_at: string | null;
    status: string;
    source: string | null;
    utm_campaign: string | null;
    created_at: string;
    operator: { display_name: string } | null;
  }[];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '');
  const lines = [
    ['WhatsApp', 'Data da conversa', 'Consentimento', 'Contatado em', 'Status', 'Origem', 'Campanha', 'Persona'].map(esc).join(';'),
    ...rows.map((r) =>
      [r.whatsapp_e164, fmt(r.created_at), fmt(r.whatsapp_consent_at), fmt(r.contacted_at), r.status, r.source, r.utm_campaign, r.operator?.display_name]
        .map(esc)
        .join(';'),
    ),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return rows.length;
}

export async function fetchLandingVisitMetrics(days: number): Promise<LandingVisitMetrics> {
  const { data, error } = await supabase.rpc('admin_landing_visit_metrics', { p_days: days });
  if (error) throw error;
  return data as LandingVisitMetrics;
}
