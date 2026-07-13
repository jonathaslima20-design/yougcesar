import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';

export default function SubscriptionBlocker() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { isOpen, isForced, limitReason, offerDiscount, setForced, openModal, closeModal, forceClose } = useSubscriptionModal();

  const isOnCheckout = location.pathname === '/dashboard/checkout';

  useEffect(() => {
    if (loading || !user) return;

    const isAdmin = user.role === 'admin';
    const isParceiro = user.role === 'parceiro';
    const hasActivePlan = user.plan_status === 'active';
    const isFreePlan = user.plan_status === 'free';
    const isExpired = user.plan_status === 'expired';
    const isSuspended = user.plan_status === 'suspended';

    if (isAdmin || isParceiro) {
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
    />
  );
}
