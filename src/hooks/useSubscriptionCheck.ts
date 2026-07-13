import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';

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
    const hasActivePlan = user.plan_status === 'active';
    const isFreePlan = user.plan_status === 'free';

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

  return {
    hasActivePlan: user?.plan_status === 'active',
    isFreePlan: user?.plan_status === 'free',
    hasAccess: user?.plan_status === 'active' || user?.plan_status === 'free',
  };
}
