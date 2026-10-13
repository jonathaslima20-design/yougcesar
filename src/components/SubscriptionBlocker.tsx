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

  const { isSubscriber: hasActivePlan, isFreePlan, isExpired, isSuspended, isTrial, isTrialExpired } = getSubscriberAccess(user?.plan_status);
  const isAdminOrPartner = user?.role === 'admin' || user?.role === 'parceiro';
  // Unlocked dashboard: paying subscriber or an active trial (both give full access).
  const unlocked = hasActivePlan || isTrial;
  // The "boas-vindas" signup offer only makes sense for users who never had a
  // plan (plan_status = 'inactive') — not for expired/suspended renewals or an
  // active/expired trial, which land on the same forced modal but without this offer.
  const isNewUnsubscribed = !isAdminOrPartner && !isFreePlan && !hasActivePlan && !isExpired && !isSuspended && !isTrial && !isTrialExpired;

  useSignupOffer(!loading && !!user && isNewUnsubscribed && !isOnCheckout);

  useEffect(() => {
    if (loading || !user) return;

    if (isAdminOrPartner) {
      forceClose();
      return;
    }

    if (isFreePlan) return;

    if (unlocked) {
      if (isForced) forceClose();
      return;
    }

    // User is blocked (expired/suspended/trial ended) but on checkout — hide modal, keep forced state
    if ((isSuspended || isExpired || isTrialExpired || !unlocked) && isOnCheckout) {
      if (isOpen) closeModal();
      if (!isForced) setForced(true);
      return;
    }

    // User is blocked and NOT on checkout — force modal open
    if ((isSuspended || isExpired || isTrialExpired || !unlocked) && !isOpen) {
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
