import { supabase } from './supabase';
import type { ActivityAction } from '@/types';
import { getStoredUser } from '@/lib/auth/simpleAuth';

export function logActivity(
  action: ActivityAction,
  description: string,
  entityType?: string,
  entityId?: string
): void {
  const user = getStoredUser();
  if (!user?.id) return;

  const userAgent = navigator.userAgent || undefined;

  supabase
    .from('user_activity_logs')
    .insert({
      user_id: user.id,
      action,
      description,
      entity_type: entityType || null,
      entity_id: entityId || null,
      user_agent: userAgent || null,
    })
    .then(({ error }) => {
      if (error) console.error('Activity log error:', error.message);
    });
}

export function logActivityForUser(
  userId: string,
  action: ActivityAction,
  description: string,
  entityType?: string,
  entityId?: string
): void {
  supabase
    .from('user_activity_logs')
    .insert({
      user_id: userId,
      action,
      description,
      entity_type: entityType || null,
      entity_id: entityId || null,
    })
    .then(({ error }) => {
      if (error) console.error('Activity log error:', error.message);
    });
}
