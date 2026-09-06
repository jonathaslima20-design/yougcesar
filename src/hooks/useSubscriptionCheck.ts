import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';
import { getSubscriberAccess } from '@/lib/subscriptionAccess';

export function useSubscriptionCheck() {
  const { user } = useAuth();
  const { openModal, closeModal, setForced, isOpen, isForced } = useSubscriptionModal();
  const isOpenRef = useRef(isOpen);
  const isForcedRef = useRef(isForced);

  useEffect(() => {
    isOpenRef.current = isOpen;
    isForcedRef.current = isForced;
  }, [isOpen, isForced]);

  useEffect(() => {
    if (!user) return;

    const isAdmin = user.role === 'admin';
    const isParceiro = user.role === 'parceiro';
    const { isSubscriber: hasActivePlan, isFreePlan } = getSubscriberAccess(user.plan_status);

    if (isAdmin || isParceiro || isFreePlan) {
      if (isForcedRef.current) {
        setForced(false);
        closeModal();
      }
      return;
    }

    if (!hasActivePlan) {
      openModal(true);
      setForced(true);
    } else if (isForcedRef.current) {
      closeModal();
      setForced(false);
    }
  }, [user, openModal, closeModal, setForced]);

  const { isSubscriber, isFreePlan, hasAccess } = getSubscriberAccess(user?.plan_status);

  return {
    hasActivePlan: isSubscriber,
    isFreePlan,
    hasAccess,
  };
}
