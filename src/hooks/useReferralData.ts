import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getReferralStats, generateReferralLink } from '@/lib/referralUtils';
import type { ReferralStats, ReferralCommission, WithdrawalRequest, UserPixKey } from '@/types';

export interface ReferredUser {
  id: string;
  name: string | null;
  email: string;
  plan_status: string;
  created_at: string;
}

interface UseReferralDataReturn {
  stats: ReferralStats | null;
  commissions: ReferralCommission[];
  withdrawals: WithdrawalRequest[];
  pixKeys: UserPixKey[];
  referralLink: string;
  clickCount: number;
  referredUsers: ReferredUser[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export function useReferralData(userId: string | undefined): UseReferralDataReturn {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [pixKeys, setPixKeys] = useState<UserPixKey[]>([]);
  const [referralLink, setReferralLink] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', userId)
        .single();

      if (userError) {
        setError('Erro ao carregar dados do usuário');
      }

      let referralCode = user?.referral_code;

      if (!referralCode || referralCode.length > 10) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = 'VT';
        for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
        referralCode = code;
        await supabase
          .from('users')
          .update({ referral_code: referralCode })
          .eq('id', userId);
      }

      if (referralCode) {
        setReferralLink(generateReferralLink(referralCode));
      }

      const referralStats = await getReferralStats(userId);
      setStats(referralStats);

      // Fetch click count
      const { count } = await supabase
        .from('referral_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', userId);
      setClickCount(count || 0);

      // Fetch referred users
      const { data: referred } = await supabase
        .from('users')
        .select('id, name, email, plan_status, created_at')
        .eq('referred_by', userId)
        .order('created_at', { ascending: false });
      setReferredUsers(referred || []);

      // Fetch commissions
      const { data: commissionsData } = await supabase
        .from('referral_commissions')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });
      setCommissions(commissionsData || []);

      // Fetch withdrawals
      const { data: withdrawalsData } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setWithdrawals(withdrawalsData || []);

      // Fetch PIX keys
      const { data: pixKeysData } = await supabase
        .from('user_pix_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setPixKeys(pixKeysData || []);

    } catch (err) {
      console.error('[ReferralData] Error:', err);
      setError('Erro ao carregar dados de indicações');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for referred users plan changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`referral-users-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `referred_by=eq.${userId}`,
        },
        (payload) => {
          setReferredUsers((prev) =>
            prev.map((u) =>
              u.id === payload.new.id
                ? { ...u, plan_status: payload.new.plan_status, name: payload.new.name }
                : u
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    stats,
    commissions,
    withdrawals,
    pixKeys,
    referralLink,
    clickCount,
    referredUsers,
    isLoading,
    error,
    refreshData: fetchData,
  };
}
