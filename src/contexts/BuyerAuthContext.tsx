import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  registerBuyer,
  authenticateBuyer,
  logoutBuyer,
  getStoredCustomer,
  resolveBuyerSession,
  signInWithGoogleBuyer,
  updateBuyerProfile,
  type Customer,
} from '@/lib/auth/buyerAuth';

interface BuyerAuthContextType {
  customer: Customer | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    data: { full_name: string; whatsapp?: string; country_code?: string }
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: (options?: { redirectTo?: string; storeSlug?: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
  updateProfile: (data: {
    full_name: string;
    whatsapp?: string | null;
    country_code?: string;
  }) => Promise<{ error: string | null }>;
}

const BuyerAuthContext = createContext<BuyerAuthContextType | undefined>(undefined);

export function BuyerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getStoredCustomer();
    if (cached) {
      setCustomer(cached);
      setLoading(false);
    }

    // Reconcile with whatever Supabase Auth session actually exists (handles
    // page reloads and cross-tab session restoration via the buyer client).
    resolveBuyerSession().then(({ customer: resolved }) => {
      setCustomer(resolved);
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { customer: authenticated, error } = await authenticateBuyer(email, password);
      if (error) return { error };
      setCustomer(authenticated);
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    data: { full_name: string; whatsapp?: string; country_code?: string }
  ) => {
    setLoading(true);
    try {
      const { customer: registered, error } = await registerBuyer(email, password, data);
      if (error) return { error };
      setCustomer(registered);
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (options?: { redirectTo?: string; storeSlug?: string }) => {
    return signInWithGoogleBuyer(options);
  };

  const signOut = async () => {
    await logoutBuyer();
    setCustomer(null);
  };

  const refreshCustomer = async () => {
    const { customer: resolved } = await resolveBuyerSession();
    setCustomer(resolved);
  };

  const updateProfile = async (data: { full_name: string; whatsapp?: string | null; country_code?: string }) => {
    if (!customer) return { error: 'Nenhum comprador autenticado' };
    const { customer: updated, error } = await updateBuyerProfile(customer.id, data);
    if (error) return { error };
    setCustomer(updated);
    return { error: null };
  };

  const value = {
    customer,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refreshCustomer,
    updateProfile,
  };

  return <BuyerAuthContext.Provider value={value}>{children}</BuyerAuthContext.Provider>;
}

export const useBuyerAuth = () => {
  const context = useContext(BuyerAuthContext);
  if (context === undefined) {
    throw new Error('useBuyerAuth must be used within a BuyerAuthProvider');
  }
  return context;
};
