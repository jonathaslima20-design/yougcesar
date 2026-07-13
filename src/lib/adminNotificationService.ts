import { supabase } from '@/lib/supabase';
import type {
  NotificationTemplate,
  NotificationRule,
  NotificationBroadcast,
  NotificationCategory,
  TargetAudience,
  RuleType,
  NotificationType,
} from '@/types';

// Templates
export async function fetchTemplates(): Promise<NotificationTemplate[]> {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .order('category')
    .order('created_at');

  if (error) throw error;
  return data || [];
}

export async function fetchTemplatesByCategory(category: NotificationCategory): Promise<NotificationTemplate[]> {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('category', category)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

export async function createTemplate(template: {
  slug: string;
  category: NotificationCategory;
  notification_type: NotificationType;
  title_template: string;
  message_template: string;
  cta_label?: string | null;
  cta_url?: string | null;
  is_enabled?: boolean;
}): Promise<NotificationTemplate> {
  const { data, error } = await supabase
    .from('notification_templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTemplate(
  id: string,
  updates: Partial<Pick<NotificationTemplate, 'title_template' | 'message_template' | 'cta_label' | 'cta_url' | 'is_enabled' | 'category' | 'notification_type'>>
): Promise<NotificationTemplate> {
  const { data, error } = await supabase
    .from('notification_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('notification_templates')
    .delete()
    .eq('id', id)
    .eq('is_system', false);

  if (error) throw error;
}

export async function toggleTemplate(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('notification_templates')
    .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// Rules
export async function fetchRules(templateId?: string): Promise<NotificationRule[]> {
  let query = supabase
    .from('notification_rules')
    .select('*, notification_templates(id, slug, title_template, category, notification_type)')
    .order('created_at');

  if (templateId) {
    query = query.eq('template_id', templateId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createRule(rule: {
  template_id: string;
  rule_type: RuleType;
  rule_config: Record<string, unknown>;
  target_audience: TargetAudience;
  cooldown_hours: number;
  is_enabled?: boolean;
}): Promise<NotificationRule> {
  const { data, error } = await supabase
    .from('notification_rules')
    .insert(rule)
    .select('*, notification_templates(id, slug, title_template, category, notification_type)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateRule(
  id: string,
  updates: Partial<Pick<NotificationRule, 'rule_type' | 'rule_config' | 'target_audience' | 'cooldown_hours' | 'is_enabled'>>
): Promise<void> {
  const { error } = await supabase
    .from('notification_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('notification_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function toggleRule(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('notification_rules')
    .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// Broadcasts
export async function fetchBroadcasts(
  page = 0,
  limit = 20,
  filters?: { status?: string; type?: string }
): Promise<{ data: NotificationBroadcast[]; count: number }> {
  let query = supabase
    .from('notification_broadcasts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.type) {
    query = query.eq('notification_type', filters.type);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function createBroadcast(broadcast: {
  title: string;
  message: string;
  notification_type: NotificationType;
  cta_label?: string | null;
  cta_url?: string | null;
  target_audience: TargetAudience;
  target_user_ids?: string[] | null;
  scheduled_at?: string | null;
  status: 'draft' | 'scheduled';
  sent_by?: string;
  template_id?: string | null;
}): Promise<NotificationBroadcast> {
  const { data, error } = await supabase
    .from('notification_broadcasts')
    .insert(broadcast)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function sendBroadcastNow(broadcastId: string): Promise<number> {
  const { data, error } = await supabase.rpc('send_broadcast_notifications', {
    p_broadcast_id: broadcastId,
  });

  if (error) throw error;
  return data as number;
}

export async function cancelBroadcast(broadcastId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_broadcasts')
    .update({ status: 'draft', scheduled_at: null, updated_at: new Date().toISOString() })
    .eq('id', broadcastId)
    .eq('status', 'scheduled');

  if (error) throw error;
}

export async function estimateRecipients(
  targetAudience: TargetAudience,
  targetUserIds?: string[]
): Promise<number> {
  if (targetAudience === 'specific' && targetUserIds) {
    return targetUserIds.length;
  }

  let query = supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .not('role', 'in', '("admin","parceiro")');

  if (targetAudience === 'active') {
    query = query.eq('plan_status', 'active');
  } else if (targetAudience === 'expired') {
    query = query.eq('plan_status', 'expired');
  } else if (targetAudience === 'free') {
    query = query.eq('plan_status', 'free');
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function searchUsersForBroadcast(query: string): Promise<{ id: string; name: string; email: string }[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .not('role', 'in', '("admin","parceiro")')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;
  return data || [];
}
