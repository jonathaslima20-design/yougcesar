export interface LiveChatOperator {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
}

export interface LiveChatPublicConfig {
  tracking_enabled: boolean;
  chat_available: boolean;
  typing_indicator_enabled?: boolean;
  open_delay_seconds?: number;
  show_on_mobile?: boolean;
  greeting_cta?: string;
  quick_replies?: string[];
  timezone?: string;
}

export interface VisitorSession {
  session_id: string;
  token: string;
  operator: LiveChatOperator | null;
}

export interface StoredConversation {
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
  updated_at: string;
}

export interface LiveChatOperatorRow {
  id: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
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
}

export interface AdminChatMessageRow extends ChatMessage {
  conversation_id: string;
  admin_user_id: string | null;
}
