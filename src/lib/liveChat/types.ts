export interface LiveChatOperator {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  /** saudação personalizada (com variáveis); vazio = padrão */
  greeting?: string | null;
}

export interface LiveChatPublicConfig {
  tracking_enabled: boolean;
  chat_available: boolean;
  chat_enabled?: boolean;
  operator_online?: boolean;
  away_message?: string;
  fallback_operator?: { name: string; avatar_url: string | null };
  typing_indicator_enabled?: boolean;
  open_delay_seconds?: number;
  show_on_mobile?: boolean;
  greeting_cta?: string;
  quick_replies?: string[];
  timezone?: string;
  hide_for_active_customers?: boolean;
  auto_open?: boolean;
  delay_trigger_enabled?: boolean;
  trigger_section?: string | null;
  trigger_scroll_percent?: number | null;
  trigger_exit_intent?: boolean;
  reopen_cooldown_days?: number;
}

export interface HeartbeatResult {
  tracking_enabled: boolean;
  chat_enabled?: boolean;
  chat_available: boolean;
  operator_online?: boolean;
  proactive?: { conversation_id: string; channel_key: string; token: string; operator: LiveChatOperator | null; force_open?: boolean } | null;
}

export interface VisitorSession {
  session_id: string;
  token: string;
  operator: LiveChatOperator | null;
}

export interface StoredConversation {
  /** só na entrega de conversa iniciada pelo admin; não é guardado */
  force_open?: boolean;
  conversation_id: string;
  channel_key: string;
  token: string;
  operator: LiveChatOperator | null;
  saved_at: number;
}

export type ChatSender = 'visitor' | 'operator' | 'system';
export type ChatMessageKind = 'text' | 'quick_reply' | 'whatsapp';

export interface ChatMessage {
  id: number;
  sender: ChatSender;
  body: string;
  kind: ChatMessageKind;
  created_at: string;
  pending?: boolean;
}

export interface BusinessHoursDay {
  enabled: boolean;
  start: string;
  end: string;
}

export interface LiveChatSettings {
  id: number;
  chat_enabled: boolean;
  tracking_enabled: boolean;
  typing_indicator_enabled: boolean;
  business_hours_enabled: boolean;
  business_hours: Record<string, BusinessHoursDay>;
  timezone: string;
  open_delay_seconds: number;
  show_on_mobile: boolean;
  greeting_cta: string;
  quick_replies: string[];
  retention_session_days: number;
  retention_conversation_days: number;
  fallback_operator_name: string;
  fallback_avatar_url: string | null;
  admin_available: boolean;
  admin_last_seen_at: string | null;
  away_behavior: 'ask_whatsapp' | 'hide';
  away_message: string;
  hide_for_active_customers: boolean;
  auto_open: boolean;
  delay_trigger_enabled: boolean;
  trigger_section: string | null;
  trigger_scroll_percent: number | null;
  trigger_exit_intent: boolean;
  reopen_cooldown_days: number;
  paused_until: string | null;
  holidays: string[];
  auto_close_idle_hours: number;
  unanswered_alert_minutes: number;
  updated_at: string;
}

export type LiveChatState = 'off' | 'paused' | 'holiday' | 'closed_hours' | 'away' | 'online';

export interface LiveChatAdminStatus {
  state: LiveChatState;
  chat_available: boolean;
  operator_online: boolean;
  admin_available: boolean;
  admin_last_seen_at: string | null;
  away_behavior: 'ask_whatsapp' | 'hide';
  paused_until: string | null;
  next_open_at: string | null;
  active_operators: number;
}

export interface CannedReply {
  id: string;
  title: string;
  body: string;
  sort_order: number;
}

export interface LiveChatMetrics {
  days: number;
  session_retention_days: number;
  sessions: number;
  conversations: number;
  visitor_started: number;
  operator_started: number;
  whatsapp_leads: number;
  contacted: number;
  unanswered: number;
  avg_first_response_seconds: number | null;
  by_operator: { name: string; conversations: number; whatsapp: number }[];
  by_source: { source: string; conversations: number; whatsapp: number }[];
  by_day: { day: string; sessions: number; conversations: number; whatsapp: number }[];
}

export interface LiveChatOperatorRow {
  id: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
  greeting_template: string | null;
  is_active: boolean;
  weight: number;
  created_at: string;
}

export interface VisitorSessionRow {
  id: string;
  visitor_id: string;
  operator_id: string | null;
  started_at: string;
  last_seen_at: string;
  last_interaction_at: string;
  current_path: string | null;
  current_section: string | null;
  sections_seen: string[];
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device: 'mobile' | 'desktop' | null;
  visit_number: number;
  ended_at: string | null;
}

export type ConversationStatus = 'open' | 'pending' | 'closed';

export interface ChatConversationRow {
  id: string;
  session_id: string | null;
  visitor_id: string;
  operator_id: string | null;
  channel_key: string;
  status: ConversationStatus;
  whatsapp_e164: string | null;
  whatsapp_consent_at: string | null;
  unread_for_admin: number;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender: ChatSender | null;
  created_at: string;
  closed_at: string | null;
  first_response_at?: string | null;
  contacted_at?: string | null;
  started_by?: 'visitor' | 'operator';
  source?: string | null;
  utm_campaign?: string | null;
}

export interface AdminChatMessageRow extends ChatMessage {
  conversation_id: string;
  admin_user_id: string | null;
}

export interface LandingVisitMetrics {
  days: number;
  timezone: string;
  tracking_enabled: boolean;
  session_retention_days: number;
  first_day: string | null;
  live_now: number;
  sessions: number;
  unique_visitors: number;
  unique_is_partial: boolean;
  new_visitors: number;
  mobile: number;
  desktop: number;
  avg_duration_seconds: number | null;
  bounces: number;
  conversations: number;
  whatsapp_leads: number;
  section_reach: Record<string, number>;
  sources: { source: string; sessions: number }[];
  hours: { hour: number; sessions: number }[];
  by_day: { day: string; sessions: number; unique_visitors: number; conversations: number; whatsapp: number }[];
}
