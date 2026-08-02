import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  authenticateAffiliate,
  logoutAffiliate,
  getStoredAffiliate,
  resolveAffiliateSession,
  updateAffiliateProfile,
  changeAffiliatePassword,
  type AffiliateProfile,
} from '@/lib/auth/affiliateAuth';

interface AffiliateAuthContextType {
  affiliate: AffiliateProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshAffiliate: () => Promise<void>;
  updateProfile: (data: {
    name: string;
    whatsapp?: string | null;
    pix_key?: string | null;
    pix_key_type?: AffiliateProfile['pix_key_type'];
    pix_holder_name?: string | null;
  }) => Promise<{ error: string | null }>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AffiliateAuthContext = createContext<AffiliateAuthContextType | undefined>(undefined);

export function AffiliateAuthProvider({ children }: { children: ReactNode }) {
  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getStoredAffiliate();
    if (cached) {
      setAffiliate(cached);
      setLoading(false);
    }

    resolveAffiliateSession().then(({ affiliate: resolved }) => {
      setAffiliate(resolved);
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { affiliate: authenticated, error } = await authenticateAffiliate(email, password);
      if (error) return { error };
      setAffiliate(authenticated);
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await logoutAffiliate();
    setAffiliate(null);
  };

  const refreshAffiliate = async () => {
    const { affiliate: resolved } = await resolveAffiliateSession();
    setAffiliate(resolved);
  };

  const updateProfile = async (data: {
    name: string;
    whatsapp?: string | null;
    pix_key?: string | null;
    pix_key_type?: AffiliateProfile['pix_key_type'];
    pix_holder_name?: string | null;
  }) => {
    if (!affiliate) return { error: 'Nenhum afiliado autenticado' };
    const { affiliate: updated, error } = await updateAffiliateProfile(affiliate.id, data);
    if (error) return { error };
    setAffiliate(updated);
    return { error: null };
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await changeAffiliatePassword(newPassword);
    return { error };
  };

  const value = { affiliate, loading, signIn, signOut, refreshAffiliate, updateProfile, changePassword };

  return <AffiliateAuthContext.Provider value={value}>{children}</AffiliateAuthContext.Provider>;
}

export const useAffiliateAuth = () => {
  const context = useContext(AffiliateAuthContext);
  if (context === undefined) {
    throw new Error('useAffiliateAuth must be used within an AffiliateAuthProvider');
  }
  return context;
};
