import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface CustomDomainState {
  isCustomDomain: boolean;
  userId: string | null;
  slug: string | null;
  domain: string | null;
  loading: boolean;
}

const CustomDomainContext = createContext<CustomDomainState>({
  isCustomDomain: false,
  userId: null,
  slug: null,
  domain: null,
  loading: true,
});

const KNOWN_HOSTS = [
  'vitrineturbo.com', 'www.vitrineturbo.com',
  'vitrineturbo.com.br', 'www.vitrineturbo.com.br',
  'localhost', '127.0.0.1',
];

function isCustomDomainHostname(hostname: string): boolean {
  if (KNOWN_HOSTS.includes(hostname)) return false;
  if (hostname.endsWith('.netlify.app')) return false;
  if (hostname.endsWith('.vercel.app')) return false;
  if (hostname.endsWith('.bolt.host')) return false;
  return true;
}

function getDomainVariants(hostname: string): string[] {
  if (hostname.startsWith('www.')) {
    return [hostname, hostname.slice(4)];
  }
  return [hostname, `www.${hostname}`];
}

export function CustomDomainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CustomDomainState>({
    isCustomDomain: false,
    userId: null,
    slug: null,
    domain: null,
    loading: true,
  });

  useEffect(() => {
    const hostname = window.location.hostname;

    if (!isCustomDomainHostname(hostname)) {
      setState({ isCustomDomain: false, userId: null, slug: null, domain: null, loading: false });
      return;
    }

    const cacheKey = `custom_domain_${hostname}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setState({ ...parsed, loading: false });
        return;
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    // Safety timeout: if resolution takes longer than 5s, fall through as non-custom domain
    const timeout = setTimeout(() => {
      setState({ isCustomDomain: false, userId: null, slug: null, domain: null, loading: false });
    }, 5000);

    resolveCustomDomain(hostname, cacheKey).finally(() => clearTimeout(timeout));
  }, []);

  const resolveCustomDomain = async (hostname: string, cacheKey: string): Promise<void> => {
    try {
      const variants = getDomainVariants(hostname);

      const { data: domainRecord } = await supabase
        .from('custom_domains')
        .select('user_id')
        .in('domain', variants)
        .eq('status', 'active')
        .maybeSingle();

      if (!domainRecord) {
        const result = { isCustomDomain: false, userId: null, slug: null, domain: null };
        setState({ ...result, loading: false });
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, slug')
        .eq('id', domainRecord.user_id)
        .eq('is_blocked', false)
        .maybeSingle();

      if (!userData) {
        const result = { isCustomDomain: false, userId: null, slug: null, domain: null };
        setState({ ...result, loading: false });
        return;
      }

      const result = {
        isCustomDomain: true,
        userId: userData.id,
        slug: userData.slug || null,
        domain: hostname,
      };

      sessionStorage.setItem(cacheKey, JSON.stringify(result));
      setState({ ...result, loading: false });
    } catch (error) {
      console.error('Error resolving custom domain:', error);
      setState({ isCustomDomain: false, userId: null, slug: null, domain: null, loading: false });
    }
  };

  return (
    <CustomDomainContext.Provider value={state}>
      {children}
    </CustomDomainContext.Provider>
  );
}

export function useCustomDomain() {
  return useContext(CustomDomainContext);
}
