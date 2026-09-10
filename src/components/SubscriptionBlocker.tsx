import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';
import { useSignupOffer } from '@/hooks/useSignupOffer';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';
import { getSubscriberAccess } from '@/lib/subscriptionAccess';

export default function SubscriptionBlocker() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { isOpen, isForced, limitReason, offerDiscount, signupOffer, setForced, openModal, closeModal, forceClose } = useSubscriptionModal();

  const isOnCheckout = location.pathname === '/dashboard/checkout';

  const { isSubscriber: hasActivePlan, isFreePlan, isExpired, isSuspended } = getSubscriberAccess(user?.plan_status);
  const isAdminOrPartner = user?.role === 'admin' || user?.role === 'parceiro';
  // The "boas-vindas" signup offer only makes sense for users who never had a
  // plan (plan_status = 'inactive') — not for expired/suspended renewals, which
  // land on the same forced modal but without this offer.
  const isNewUnsubscribed = !isAdminOrPartner && !isFreePlan && !hasActivePlan && !isExpired && !isSuspended;

  useSignupOffer(!loading && !!user && isNewUnsubscribed && !isOnCheckout);

  useEffect(() => {
    if (loading || !user) return;

    if (isAdminOrPartner) {
      forceClose();
      return;
    }

    if (isFreePlan) return;

    if (hasActivePlan) {
      if (isForced) forceClose();
      return;
    }

    // User is blocked (expired/suspended) but on checkout — hide modal, keep forced state
    if ((isSuspended || isExpired || !hasActivePlan) && isOnCheckout) {
      if (isOpen) closeModal();
      if (!isForced) setForced(true);
      return;
    }

    // User is blocked and NOT on checkout — force modal open
    if ((isSuspended || isExpired || !hasActivePlan) && !isOpen) {
      openModal(true);
      setForced(true);
    }
  }, [user, loading, isOnCheckout]);

  // Don't render the modal overlay when on checkout page
  if (isOnCheckout) return null;

  return (
    <SubscriptionModal
      open={isOpen}
      onOpenChange={(open) => { if (!open) closeModal(); }}
      isForced={isForced}
      limitReason={limitReason}
      planStatus={user?.plan_status}
      offerDiscount={offerDiscount}
      signupOffer={signupOffer}
    />
  );
}
