import { supabase } from '@/lib/supabase';
import type {
  NotificationBroadcast,
  TargetAudience,
  NotificationType,
} from '@/types';

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
