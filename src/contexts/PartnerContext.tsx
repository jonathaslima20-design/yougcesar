import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { partnerApi, type PartnerOverview, type PartnerProfile, type PartnerSettings } from '@/lib/partners/partnerApi';

interface PartnerContextValue {
  overview: PartnerOverview | null;
  profile: PartnerProfile | null;
  settings: PartnerSettings | null;
  loading: boolean;
  error: string | null;
  /** The partner account the caller acts for (owner id for agency staff). */
  partnerId: string | null;
  isOwner: boolean;
  canManage: boolean;
  refresh: () => Promise<void>;
}

const PartnerContext = createContext<PartnerContextValue | null>(null);

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [overview, setOverview] = useState<PartnerOverview | null>(null);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [settings, setSettings] = useState<PartnerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [ov, st] = await Promise.all([partnerApi.overview(), partnerApi.settings()]);
      setOverview(ov);
      setSettings(st);
      setProfile(await partnerApi.profile(ov.partner_id));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const role = overview?.team_role;
  return (
    <PartnerContext.Provider
      value={{
        overview,
        profile,
        settings,
        loading,
        error,
        partnerId: overview?.partner_id ?? null,
        isOwner: role === 'owner',
        canManage: role === 'owner' || role === 'manager',
        refresh,
      }}
    >
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error('usePartner must be used inside PartnerProvider');
  return ctx;
}
