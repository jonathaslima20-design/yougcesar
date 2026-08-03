import { supabase } from './supabase';

export interface AffiliateTeaserMonitoringRow {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  views_count: number;
  clicks_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  last_clicked_at: string | null;
}

export async function fetchAffiliateTeaserMonitoring(): Promise<AffiliateTeaserMonitoringRow[]> {
  const { data, error } = await supabase.rpc('list_affiliate_teaser_monitoring');
  if (error) throw error;
  return data || [];
}
