import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { claimPendingPartnerAttribution, trackPartnerClick } from '@/lib/partners/partnerAttribution';

/**
 * Captures ?ref=CODE on any page (not only the landing) for partner codes and,
 * once a merchant is logged in, attaches the stored partner link to the signup.
 */
export default function PartnerAttributionTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const lastRef = useRef<string | null>(null);
  const claimedFor = useRef<string | null>(null);

  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref');
    if (!ref || ref === lastRef.current || location.pathname.startsWith('/p/')) return;
    lastRef.current = ref;
    trackPartnerClick(ref).catch(() => undefined);
  }, [location.search, location.pathname]);

  useEffect(() => {
    if (!user?.id || claimedFor.current === user.id) return;
    claimedFor.current = user.id;
    claimPendingPartnerAttribution(user as { id: string; role?: string; created_at?: string }).catch(() => undefined);
  }, [user]);

  return null;
}
